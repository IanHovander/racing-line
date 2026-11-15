import { test, expect, type Page } from 'playwright/test';

// Joining a room, and remembering the player's name. The tests never touch the internet: PeerJS is replaced by a
// stand-in that lives inside the page (see fakeNet), so a host and a guest can share one page and the
// connection can be made to fail in chosen ways.
declare const window: any;

/** Runs in the page before the game loads. The game picks up window.Peer instead of loading PeerJS. */
function fakeNet() {
  const net = (window.__net = {
    peers: new Map<string, any>(),
    /** this many connection attempts fail before one opens */
    failConnects: 0,
    /** connection attempts get no reply at all */
    hang: false,
    connects: 0,
    n: 0,
  });
  class Emitter {
    h: Record<string, ((...a: any[]) => void)[]> = {};
    on(ev: string, f: (...a: any[]) => void) {
      (this.h[ev] = this.h[ev] || []).push(f);
      return this;
    }
    emit(ev: string, ...a: any[]) {
      for (const f of this.h[ev] || []) f(...a);
    }
  }
  class Conn extends Emitter {
    open = false;
    closed = false;
    other: Conn | null = null;
    constructor(public peer: string) {
      super();
    }
    send(m: any) {
      const o = this.other;
      if (this.open && o) setTimeout(() => o.open && o.emit('data', JSON.parse(JSON.stringify(m))), 1);
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      const was = this.open;
      this.open = false;
      if (was) this.emit('close');
      const o = this.other;
      if (o && !o.closed) setTimeout(() => o.close(), 1);
    }
  }
  class Peer extends Emitter {
    id: string;
    destroyed = false;
    disconnected = false;
    constructor(id?: any) {
      super();
      this.id = typeof id === 'string' ? id : 'guest-' + ++net.n;
      setTimeout(() => {
        if (this.destroyed) return;
        if (net.peers.has(this.id)) return this.emit('error', { type: 'unavailable-id' });
        net.peers.set(this.id, this);
        this.emit('open', this.id);
      }, 5);
    }
    connect(to: string) {
      const c = new Conn(to);
      net.connects++;
      setTimeout(() => {
        if (net.hang) return;
        const hub = net.peers.get(to);
        if (!hub) return this.emit('error', { type: 'peer-unavailable' });
        if (net.failConnects > 0) {
          net.failConnects--;
          return c.emit('error', { type: 'negotiation-failed' });
        }
        const r = new Conn(this.id);
        c.other = r;
        r.other = c;
        hub.emit('connection', r);
        setTimeout(() => {
          r.open = c.open = true;
          r.emit('open');
          c.emit('open');
        }, 5);
      }, 5);
      return c;
    }
    reconnect() {}
    disconnect() {}
    destroy() {
      this.destroyed = true;
      if (net.peers.get(this.id) === this) net.peers.delete(this.id);
    }
  }
  window.Peer = Peer;
}

async function open(page: Page, url = '/?debug') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(fakeNet);
  await page.goto(url);
  await page.waitForFunction(() => typeof window.wzGo === 'function' && window.MP && window.MP.api);
  // no need to wait seconds for a retry in a test
  await page.evaluate(() => Object.assign(window.P2P, { findMs: 40, connMs: 600, openMs: 600 }));
  return errors;
}
const HOST = { v: 1, nick: 'Hosty', team: 1, role: 'host', phase: 'lobby', jt: 1 };

test('a guest keeps trying until the connection to the host opens', async ({ page }) => {
  const errors = await open(page);
  const r = await page.evaluate(async () => {
    const api = window.makeP2PApi();
    const hub = await api.join('retry', { host: true });
    window.__net.failConnects = 2;
    const steps: string[] = [];
    const guest = await api.join('retry', { onStep: (s: string, n: number) => steps.push(s + n) });
    const flags = await new Promise(res =>
      guest.onPeers((ch: any) => ch.peers.length === 2 && res(ch.peers.map((p: any) => p.sameTab))),
    );
    await guest.leave();
    await hub.leave();
    return { connects: window.__net.connects, steps, flags };
  });
  expect(r.connects).toBe(3);
  expect(r.steps).toEqual(['server1', 'host1', 'host2', 'host3']);
  expect(r.flags).toEqual([false, true]);
  expect(errors).toEqual([]);
});

test('a guest never opens a room of its own: a code nobody is hosting is reported, and stays free', async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const api = window.makeP2PApi();
    const steps: string[] = [];
    const err = await api.join('ghost', { onStep: (s: string, n: number) => steps.push(s + n) }).then(
      () => null,
      (e: any) => e,
    );
    return {
      type: err && err.type,
      steps,
      ids: [...window.__net.peers.keys()],
      message: window.joinError(err, 'ghost', false),
    };
  });
  expect(r.type).toBe('peer-unavailable');
  expect(r.steps).toEqual(['server1', 'host1', 'find2']); // looked twice
  expect(r.ids).toEqual([]); // nothing left registered, least of all the room's own id
  expect(r.message).toContain('No race found with code GHOST');
});

test('a failed join says why, and Try Again gets in once the host is there', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(() => window.enterRoom('late1', false));
  await expect(page.locator('#mpConn')).toBeVisible();
  await expect(page.locator('#mcMsg')).toContainText('No race found with code LATE1');
  await expect(page.locator('#bMcRetry')).toBeVisible();
  expect(await page.evaluate(() => [!!window.MP.room, !!window.MP.joining])).toEqual([false, false]);
  // the host opens the room; the guest taps Try Again
  await page.evaluate(async host => {
    window.__hub = await window.makeP2PApi().join('late1', { host: true });
    await window.__hub.presence(host);
  }, HOST);
  await page.click('#bMcRetry');
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#mpConn')).toBeHidden();
  await expect(page.locator('#lbPlayers')).toContainText('Hosty');
  await expect(page.locator('#lbPlayers')).toContainText('(you)');
  expect(await page.evaluate(() => [window.MP.host, window.MP.code, location.hash])).toEqual([
    false,
    'late1',
    '#late1',
  ]);
  expect(errors).toEqual([]);
});

test('Cancel stops a join that is still waiting, and a second tap on Join does not start another', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    window.__net.hang = true;
    window.P2P.connMs = 60000;
    window.enterRoom('slow1', false);
    window.enterRoom('slow1', false); // an impatient second tap
  });
  await expect(page.locator('#mcMsg')).toContainText('Connecting to the host');
  expect(await page.evaluate(() => window.__net.connects)).toBe(1);
  await page.click('#bMcCancel');
  await expect(page.locator('#mpConn')).toBeHidden();
  await expect(page.locator('#home')).toBeVisible();
  expect(await page.evaluate(() => [!!window.MP.room, !!window.MP.joining, location.hash])).toEqual([
    false,
    false,
    '',
  ]);
});

test('a guest dropped while waiting in the lobby gets straight back in', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(async host => {
    window.__hub = await window.makeP2PApi().join('drop1', { host: true });
    await window.__hub.presence(host);
    await window.enterRoom('drop1', false);
  }, HOST);
  await expect(page.locator('#lobby')).toBeVisible();
  expect(await page.evaluate(() => window.__net.connects)).toBe(1);
  // the host's page goes away and comes back with the same code (a reload): every guest's connection is cut
  await page.evaluate(async host => {
    await window.__hub.leave();
    window.__hub = await window.makeP2PApi().join('drop1', { host: true });
    await window.__hub.presence(host);
  }, HOST);
  await expect.poll(() => page.evaluate(() => window.__net.connects)).toBeGreaterThan(1);
  await expect(page.locator('#mpConn')).toBeHidden();
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#lbPlayers')).toContainText('(you)');
  await expect(page.locator('#lbPlayers')).toContainText('Hosty');
  expect(await page.evaluate(() => [!!window.MP.room, window.MP.code, window.MP.phase])).toEqual([
    true,
    'drop1',
    'lobby',
  ]);
  // if the room has really gone, the player is told, and Close goes back to the main screen
  await page.evaluate(() => window.__hub.leave());
  await expect(page.locator('#mcTitle')).toHaveText('Lost Connection to DROP1');
  await expect(page.locator('#mcMsg')).toContainText('no longer open');
  await page.click('#bMcCancel');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#lobby')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a reloaded host page comes back as the host of the same room', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.wzHost());
  await expect(page.locator('#lobby')).toBeVisible();
  const code = await page.evaluate(() => window.MP.code);
  expect(await page.evaluate(() => location.hash)).toBe('#' + code);
  await page.reload();
  await expect(page.locator('#lobby')).toBeVisible();
  expect(await page.evaluate(() => [window.MP.host, window.MP.code])).toEqual([true, code]);
  await expect(page.locator('#bLbStart')).toBeHidden(); // Start is on the last step...
  await page.click('#lbNav button[data-s="3"]');
  await expect(page.locator('#bLbStart')).toBeVisible(); // ...and only the host has it
  // leaving the room forgets it: the same link then opens as a guest would
  await page.evaluate(() => window.leaveRoom());
  expect(await page.evaluate(() => sessionStorage.getItem('hcgp_hosting'))).toBeNull();
});

test('your name is saved as you type and read again every time the lobby opens', async ({
  page,
  context,
}) => {
  await open(page);
  await page.evaluate(() => window.wzHost());
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#nick')).toHaveValue(/^Driver-\d{3}$/);
  await page.fill('#nick', 'Ian');
  expect(await page.evaluate(() => [localStorage.getItem('hcgp_nick'), window.NICK])).toEqual([
    '"Ian"',
    'Ian',
  ]);
  await expect(page.locator('#lbPlayers')).toContainText('Ian (you)');
  // typed with stray characters and spaces: what is saved is the tidy version, shown when the box is left
  await page.fill('#nick', '  Ian <b>  H.  ');
  await page.locator('#nick').blur();
  await expect(page.locator('#nick')).toHaveValue('Ian b H.');
  expect(await page.evaluate(() => localStorage.getItem('hcgp_nick'))).toBe('"Ian b H."');
  await page.evaluate(() => window.leaveRoom());

  // the name is changed in another tab of the game: this tab follows...
  const other = await context.newPage();
  await other.goto('/?debug');
  await other.evaluate(() => localStorage.setItem('hcgp_nick', '"Grace"'));
  await expect.poll(() => page.evaluate(() => window.NICK)).toBe('Grace');
  await other.close();
  // ...and even if it missed the news (a phone tab asleep in the background), opening the lobby reads it again
  await page.evaluate(() => {
    localStorage.setItem('hcgp_nick', '"Ada"'); // no storage event in the tab that writes
    window.wzHost();
  });
  await expect(page.locator('#lobby')).toBeVisible();
  await expect(page.locator('#nick')).toHaveValue('Ada');
  await expect(page.locator('#lbPlayers')).toContainText('Ada (you)');

  // and it is there after a reload
  await page.evaluate(() => window.leaveRoom());
  await page.reload();
  await page.waitForFunction(() => window.MP && window.MP.api);
  expect(await page.evaluate(() => window.NICK)).toBe('Ada');
});

test('connections get a relay to fall back on when two players cannot reach each other directly', async ({
  page,
}) => {
  // the real PeerJS this time (served from dist/vendor): its default servers are merged into ours
  await page.goto('/?debug');
  await page.waitForFunction(() => window.MP && window.MP.api && window.peerjs);
  const urls: string[] = await page.evaluate(() => window.iceServers().flatMap((s: any) => s.urls));
  expect(urls.some(u => u.startsWith('stun:'))).toBe(true);
  expect(urls.some(u => u.startsWith('turn:'))).toBe(true);
  expect(new Set(urls).size).toBe(urls.length);
  const relay = await page.evaluate(() =>
    window.iceServers().find((s: any) => s.urls.some((u: string) => u.startsWith('turn:'))),
  );
  expect(relay.username && relay.credential).toBeTruthy();
});
