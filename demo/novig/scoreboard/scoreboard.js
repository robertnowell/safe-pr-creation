/* Live scoreboard grouped by sport: top 3 games per sport, one suggested "best odds" action per game.
   Reads window.NOVIG_GAMES (games.js). Odds come from suggestOdds() until the order-book API is wired in. */
(function () {
  var SRC = 'scoreboard/scoreboard.js';
  var TOP_N = 3;
  var games = window.NOVIG_GAMES || [];

  // Rank live games within a sport: closest score first, then latest period.
  function rank(a, b) {
    var da = Math.abs((+a.awayScore || 0) - (+a.homeScore || 0));
    var db = Math.abs((+b.awayScore || 0) - (+b.homeScore || 0));
    if (da !== db) return da - db;
    return String(b.status).localeCompare(String(a.status));
  }

  // Placeholder until the order book is wired: back the trailing side at a price implied by the score gap.
  function suggestOdds(g) {
    var a = +g.awayScore || 0, h = +g.homeScore || 0;
    var trailing = a < h ? g.away : g.home;
    var gap = Math.abs(a - h);
    var pct = Math.max(18, Math.min(49, 50 - gap * 3));
    var payout = Math.round(100 * (100 / pct));
    return { side: trailing, pct: pct, stake: 100, payout: payout, synthetic: true };
  }

  function groupBySport(list) {
    var order = [], map = {};
    list.forEach(function (g) {
      if (!map[g.sport]) { map[g.sport] = []; order.push(g.sport); }
      map[g.sport].push(g);
    });
    return order.map(function (s) { return { sport: s, games: map[s].slice().sort(rank), total: map[s].length }; });
  }

  function el(tag, cls, text, line) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (line) e.setAttribute('data-src', SRC + ':' + line);
    return e;
  }

  function teamRow(abbr, logo, score, isAway, line) {
    var row = el('div', 'sb-team', null, line);
    var left = el('div', 'sb-team-l');
    if (logo) { var img = document.createElement('img'); img.src = logo; img.alt = ''; left.appendChild(img); }
    left.appendChild(el('span', 'sb-abbr', abbr));
    if (isAway) left.appendChild(el('span', 'sb-at', 'at'));
    row.appendChild(left);
    row.appendChild(el('span', 'sb-score', score == null ? '' : String(score)));
    return row;
  }

  function gameCard(g) {
    var card = el('div', 'sb-game', null, 55);
    card.setAttribute('tabindex', '0');
    var status = el('div', 'sb-status', null, 57);
    status.appendChild(el('span', 'sb-dot'));
    status.appendChild(el('span', 'sb-clock', g.status || 'Live'));
    card.appendChild(status);
    card.appendChild(teamRow(g.away, g.awayLogo, g.awayScore, true, 44));
    card.appendChild(teamRow(g.home, g.homeLogo, g.homeScore, false, 44));
    var odds = suggestOdds(g);
    var action = el('div', 'sb-action', null, 64);
    var best = el('div', 'sb-best');
    best.appendChild(el('span', 'sb-best-k', 'Best odds'));
    var v = el('span', 'sb-best-v');
    v.innerHTML = '<b>' + odds.side + '</b> ' + odds.pct + '% · $' + odds.stake + ' ▸ $' + odds.payout;
    best.appendChild(v);
    action.appendChild(best);
    var btn = el('button', 'sb-trade', 'Trade', 71);
    btn.setAttribute('aria-label', 'Trade ' + odds.side + ' at ' + odds.pct + '%');
    action.appendChild(btn);
    card.appendChild(action);
    return card;
  }

  function sportGroup(grp) {
    var wrap = el('section', 'sb-sport', null, 79);
    var head = el('div', 'sb-sport-head', null, 80);
    head.appendChild(el('div', 'sb-sport-name', grp.sport));
    var count = el('div', 'sb-sport-count');
    count.innerHTML = '<b>' + grp.total + '</b> live';
    head.appendChild(count);
    if (grp.total > TOP_N) head.appendChild(el('div', 'sb-sport-more', 'View all'));
    wrap.appendChild(head);
    grp.games.slice(0, TOP_N).forEach(function (g) { wrap.appendChild(gameCard(g)); });
    return wrap;
  }

  function render() {
    var mount = document.getElementById('live-scoreboard');
    if (!mount) return;
    mount.innerHTML = '';
    groupBySport(games.filter(function (g) { return g.status || g.live; })).forEach(function (grp) { mount.appendChild(sportGroup(grp)); });
  }

  render();
})();
