(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const won = n => (Math.round(n / 10) * 10).toLocaleString("ko-KR") + "원";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const byId = Object.fromEntries(RECIPES.map(r => [r.id, r]));

  // 판매처별 가격 중 가장 싼 값을 price, 그 판매처를 src 로
  for (const v of Object.values(INGREDIENTS)) {
    if (!v.prices) continue;
    [v.src, v.price] = Object.entries(v.prices).sort((x, y) => x[1] - y[1])[0];
  }
  // 배달 한 끼 평균 (메뉴별 비교는 하지 않는다)
  const DELI = DELIVERY.menu + DELIVERY.tip;

  const priceList = v => v.prices
    ? Object.entries(v.prices).map(([s, p]) => s === v.src ? `<b>${esc(s)} ${won(p)}</b>` : `${esc(s)} ${won(p)}`).join(" · ")
    : won(v.price);

  // 레시피 1인분 재료비 = Σ (재료 단위 가격 × 사용 비율)
  const cost = r => r.ing.reduce((s, [k, , use]) => s + INGREDIENTS[k].price * use, 0);

  const buyLinks = k => {
    const q = encodeURIComponent(INGREDIENTS[k].search);
    return `<a href="https://www.kurly.com/search?sword=${q}" target="_blank" rel="noopener">컬리</a>` +
           `<a href="https://www.coupang.com/np/search?q=${q}" target="_blank" rel="noopener">쿠팡</a>`;
  };

  /* ---------- 상태 (선택한 재료는 이 브라우저에만 저장) ---------- */
  const KEY = "fridge-picked";
  let picked = new Set();
  try { picked = new Set(JSON.parse(localStorage.getItem(KEY) || "[]").filter(k => INGREDIENTS[k])); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...picked])); } catch (e) {} };

  /* ---------- 재료 칩 ---------- */
  $("#pantry").textContent = PANTRY.join(", ");
  $("#price-date").textContent = PRICE_DATE;

  const ICON = {
    clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  };
  const emoRow = r => r.ing.map(([k]) => `<span>${INGREDIENTS[k].emoji}</span>`).join("");

  // 히어로 숫자 — 모두 data.js 에서 계산
  const avgCost = RECIPES.reduce((s, r) => s + cost(r), 0) / RECIPES.length;
  $("#stats").innerHTML = `
    <div><dt>자취방 레시피</dt><dd>${RECIPES.length}개</dd></div>
    <div><dt>평균 1인분 재료비</dt><dd class="save">${won(avgCost)}</dd></div>
    <div><dt>배달 한 끼 평균</dt><dd>${won(DELI)}</dd><small>두 끼로 나눠 먹으면 ${won(DELI / 2)}</small></div>`;

  const chips = $("#chips");
  chips.innerHTML = Object.entries(INGREDIENTS).map(([k, v]) =>
    `<button type="button" class="chip" data-k="${k}" aria-pressed="${picked.has(k)}"><span class="e">${v.emoji}</span>${esc(v.name)}</button>`
  ).join("");
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip");
    if (!b) return;
    const k = b.dataset.k;
    picked.has(k) ? picked.delete(k) : picked.add(k);
    b.setAttribute("aria-pressed", picked.has(k));
    save(); renderResults();
  });
  $("#reset").addEventListener("click", () => {
    picked.clear(); save();
    chips.querySelectorAll(".chip").forEach(b => b.setAttribute("aria-pressed", "false"));
    renderResults();
  });
  ["#f-micro", "#f-quick", "#f-ready"].forEach(s => $(s).addEventListener("change", renderResults));

  /* ---------- 레시피 목록 ---------- */
  function renderResults() {
    const micro = $("#f-micro").checked, quick = $("#f-quick").checked, ready = $("#f-ready").checked;
    const none = picked.size === 0;

    let list = RECIPES.map(r => {
      const missing = r.ing.map(i => i[0]).filter(k => !picked.has(k));
      const hits = r.ing.length - missing.length;
      return { r, missing, hits };
    })
      .filter(x => !micro || x.r.tool === "전자레인지")
      .filter(x => !quick || x.r.time <= 10)
      .filter(x => !ready || (!none && x.missing.length === 0))
      .filter(x => none || x.hits > 0);

    list.sort((a, b) => none ? a.r.time - b.r.time
      : a.missing.length - b.missing.length || b.hits - a.hits || a.r.time - b.r.time);

    const readyN = none ? 0 : list.filter(x => x.missing.length === 0).length;
    $("#summary").innerHTML = none
      ? `레시피 <b>${list.length}개</b> — 재료를 고르면 지금 만들 수 있는 것부터 보여 드려요.`
      : `지금 바로 만들 수 있는 레시피 <b>${readyN}개</b> · 조금만 더 사면 되는 레시피 ${list.length - readyN}개`;

    $("#results").innerHTML = list.length ? list.map(({ r, missing }) => {
      const badge = none ? ""
        : missing.length === 0 ? `<span class="badge ok">지금 바로 가능</span>`
        : `<span class="badge ${missing.length <= 2 ? "need" : "far"}">${missing.map(k => INGREDIENTS[k].name).join(", ")} 필요</span>`;
      return `<button type="button" class="card" data-id="${r.id}">
        <div class="card-top"><span class="emos" aria-hidden="true">${emoRow(r)}</span>${badge}</div>
        <div class="card-body">
          <h3>${esc(r.name)}</h3>
          <div class="meta"><span>${ICON.clock}${r.time}분</span><span>${r.level}</span><span>${r.tool}</span></div>
          <div class="price"><small>1인분 재료비</small><span class="num">${won(cost(r))}</span></div>
        </div>
      </button>`;
    }).join("") : `<p class="empty">조건에 맞는 레시피가 없어요. 필터를 풀어 보세요.</p>`;
  }
  $("#results").addEventListener("click", e => {
    const c = e.target.closest(".card");
    if (c) openRecipe(c.dataset.id);
  });

  /* ---------- 레시피 상세 ---------- */
  const dlg = $("#detail");
  function openRecipe(id, fromHash) {
    const r = byId[id];
    if (!r) return;
    const c = cost(r);
    $("#d-body").innerHTML = `
      <div class="d-hero">
        <div><div class="emo" aria-hidden="true">${emoRow(r)}</div><h2 id="d-title">${esc(r.name)}</h2></div>
        <button type="button" class="close" aria-label="닫기">${ICON.close}</button>
      </div>
      <dl class="facts">
        <div><dt>조리 시간</dt><dd>${r.time}분</dd></div>
        <div><dt>난이도</dt><dd>${r.level}</dd></div>
        <div><dt>도구</dt><dd>${r.tool}</dd></div>
        <div><dt>1인분 재료비</dt><dd class="num">${won(c)}</dd></div>
      </dl>
      <div class="d-main">
        <div class="d-sec">
          <h3>재료 (1인분)</h3>
          <ul class="ing">${r.ing.map(([k, amt]) => {
            const v = INGREDIENTS[k];
            return `<li><span class="e" aria-hidden="true">${v.emoji}</span><span class="nm">${esc(v.name)}</span><span class="amt">${esc(amt)}</span>
              ${picked.has(k) ? `<span class="have">있음</span>` : ""}
              <span class="buy"><span>${esc(v.pack)} · ${priceList(v)}</span>${buyLinks(k)}</span></li>`;
          }).join("")}</ul>
          <p class="sauce"><b>양념</b>${esc(r.sauce)}</p>
        </div>

        <div class="d-sec">
          <h3>만드는 법</h3>
          <ol class="steps">${r.steps.map(s => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
        </div>

        ${r.leftover.length ? `<div class="d-sec">
          <h3>남은 재료 이어 쓰기</h3>
          <div class="chain">${r.leftover.map(([k, what, next]) => byId[next] ? `
            <button type="button" data-next="${next}">
              <span>${INGREDIENTS[k].emoji} ${esc(what)} 남았다면</span><span class="arrow" aria-hidden="true">→</span><b>${esc(byId[next].name)}</b>
            </button>` : "").join("")}</div>
        </div>` : ""}

        <div class="d-sec">
          <h3>재료비 계산</h3>
          <div class="receipt">
            <div class="rc-sec">
              <p class="rc-label">1인분에 쓰는 양만큼</p>
              ${r.ing.map(([k, amt, use]) => `<div class="rc-row"><span>${esc(INGREDIENTS[k].name)} ${esc(amt)}</span><span class="num">${won(INGREDIENTS[k].price * use)}</span></div>`).join("")}
              <div class="rc-row rc-total"><span>1인분 재료비</span><span class="num">${won(c)}</span></div>
              <p class="rc-left">양념은 집에 있다고 보고 뺐어요. 재료를 살 때는 소포장 1개 값이 들어요 (위 재료 목록 참고).</p>
            </div>
          </div>
        </div>

        <div class="d-sec">
          <h3>재료 보관 팁</h3>
          <ul class="ing tips">${r.ing.map(([k]) => {
            const v = INGREDIENTS[k];
            return `<li><span class="e" aria-hidden="true">${v.emoji}</span><span class="nm">${esc(v.name)}</span><span class="amt">${esc(v.store)} (${esc(v.keep)})</span></li>`;
          }).join("")}</ul>
        </div>
      </div>`;
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0; $("#d-body").scrollIntoView?.({ block: "start" });
    if (!fromHash) history.replaceState(null, "", "#recipe=" + id);
  }
  function closeRecipe() {
    if (dlg.open) dlg.close();
  }
  dlg.addEventListener("close", () => {
    if (location.hash.startsWith("#recipe=")) history.replaceState(null, "", location.pathname + location.search);
  });
  dlg.addEventListener("click", e => {
    if (e.target === dlg || e.target.closest(".close")) return closeRecipe();
    const n = e.target.closest("[data-next]");
    if (n) openRecipe(n.dataset.next);
  });

  // 카드뉴스 QR/링크용: index.html#recipe=tofu-braise 로 바로 열기
  const fromHash = () => {
    const m = location.hash.match(/^#recipe=([\w-]+)/);
    if (m) openRecipe(m[1], true);
  };
  window.addEventListener("hashchange", fromHash);

  /* ---------- 장바구니 만들기 (선택은 이 브라우저에만 저장) ---------- */
  const BKEY = "fridge-basket";
  let chosen;
  try { chosen = JSON.parse(localStorage.getItem(BKEY)); } catch (e) {}
  chosen = new Set(Array.isArray(chosen) ? chosen.filter(id => byId[id]) : BASKETS[0].recipes);
  const saveBasket = () => { try { localStorage.setItem(BKEY, JSON.stringify([...chosen])); } catch (e) {} };

  // 고른 메뉴 → 재료별 사용량 합계 → 소포장 몇 개를 사야 하는지 (밥은 공기 단위)
  function planBasket(ids) {
    const need = {};
    ids.forEach(id => byId[id].ing.forEach(([k, , use]) => { need[k] = (need[k] || 0) + use; }));
    const rows = Object.entries(need).map(([k, used]) => {
      const rice = k === "rice";
      const packs = rice ? used : Math.ceil(used - 1e-9);
      return { k, used, packs, rice, price: packs * INGREDIENTS[k].price, left: rice ? 0 : packs - used };
    }).sort((x, y) => x.rice - y.rice);
    const buy = rows.reduce((s, x) => s + x.price, 0);
    const leftValue = rows.reduce((s, x) => s + x.left * INGREDIENTS[x.k].price, 0);
    const leftover = Object.fromEntries(rows.filter(x => x.left > 0.05).map(x => [x.k, x.left]));
    // 이미 산 재료(남는 양)만으로 더 만들 수 있는 메뉴
    const extra = RECIPES.filter(r => !ids.includes(r.id)
      && r.ing.every(([k, , use]) => k === "rice" || (leftover[k] || 0) >= use - 1e-9));
    return { rows, buy, leftValue, leftover, extra };
  }

  $("#presets").innerHTML = BASKETS.map((b, i) =>
    `<button type="button" class="pill-btn" data-preset="${i}">${esc(b.name)}</button>`).join("") +
    `<button type="button" class="link-btn" data-preset="clear">비우기</button>`;

  function renderPicker() {
    $("#pick-list").innerHTML = RECIPES.map(r =>
      `<button type="button" class="pick" data-id="${r.id}" aria-pressed="${chosen.has(r.id)}">
        <span class="emos" aria-hidden="true">${emoRow(r)}</span><span class="nm">${esc(r.name)}</span><span class="num">${won(cost(r))}</span>
      </button>`).join("");
  }

  function renderBasket() {
    const ids = RECIPES.map(r => r.id).filter(id => chosen.has(id));
    const n = ids.length;
    if (!n) {
      $("#my-basket").innerHTML = `<article class="receipt"><div class="rc-head"><small>MY BASKET</small><h3>이번 주 장바구니</h3></div>
        <p class="rc-empty">왼쪽에서 이번 주에 만들 메뉴를 골라 주세요.</p></article>`;
      return;
    }
    const p = planBasket(ids);
    const split = Math.ceil(n / 2);
    const row = (label, amount, cls = "") => `<div class="rc-row ${cls}"><span>${label}</span><span class="num">${amount}</span></div>`;
    $("#my-basket").innerHTML = `<article class="receipt">
      <div class="rc-head"><small>MY BASKET</small><h3>이번 주 ${n}끼</h3></div>
      <div class="rc-sec">
        <p class="rc-label">장보기</p>
        ${p.rows.map(x => x.rice
          ? row(`${INGREDIENTS.rice.emoji} 밥 ${+x.used.toFixed(1)}공기`, won(x.price))
          : row(`${INGREDIENTS[x.k].emoji} ${esc(INGREDIENTS[x.k].name)} ${esc(INGREDIENTS[x.k].pack)}${x.packs > 1 ? ` ×${x.packs}` : ""}${INGREDIENTS[x.k].src ? ` <small class="src">${esc(INGREDIENTS[x.k].src)}</small>` : ""}`, won(x.price))).join("")}
        ${row("합계", won(p.buy), "rc-total")}
        <p class="rc-left">이번 주에 먹는 재료비는 ${won(p.buy - p.leftValue)} (한 끼 ${won((p.buy - p.leftValue) / n)})${Object.keys(p.leftover).length
          ? ` · 남는 재료: ${Object.entries(p.leftover).map(([k, l]) => `${INGREDIENTS[k].name} ${Math.round(l * 100)}%`).join(", ")}` : " · 남는 재료 없음"}</p>
      </div>
      ${p.extra.length ? `<div class="rc-sec">
        <p class="rc-label">남는 재료만으로 더 만들 수 있어요</p>
        <div class="extra">${p.extra.slice(0, 4).map(r => `<button type="button" class="pill-btn" data-add="${r.id}">+ ${esc(r.name)}</button>`).join("")}</div>
      </div>` : ""}
      <div class="rc-sec">
        <p class="rc-label">같은 ${n}끼를 배달로 먹는다면 (한 끼 평균 ${won(DELI)})</p>
        ${row(`한 번에 한 끼씩 · 배달 ${n}번`, won(n * DELI))}
        ${row(`두 끼로 나눠 먹으면 · 배달 ${split}번`, won(split * DELI))}
      </div>
      <div class="rc-sec">
        <div class="rc-save"><span>아끼는 돈</span><b>${won(n * DELI - p.buy)}</b></div>
        <p class="rc-left">${split * DELI >= p.buy
          ? `배달을 두 끼로 나눠 먹는 경우와 비교해도 ${won(split * DELI - p.buy)} 아껴요.`
          : `배달을 두 끼로 나눠 먹는 경우보다는 ${won(p.buy - split * DELI)} 더 들지만, 남는 재료 ${won(p.leftValue)}어치는 다음 끼니에 이어 써요.`}</p>
      </div>
    </article>`;
  }

  $("#basket").addEventListener("click", e => {
    const t = e.target.closest("[data-id],[data-preset],[data-add]");
    if (!t) return;
    if (t.dataset.preset === "clear") chosen.clear();
    else if (t.dataset.preset) chosen = new Set(BASKETS[+t.dataset.preset].recipes);
    else if (t.dataset.add) chosen.add(t.dataset.add);
    else chosen.has(t.dataset.id) ? chosen.delete(t.dataset.id) : chosen.add(t.dataset.id);
    saveBasket(); renderPicker(); renderBasket();
  });
  renderPicker(); renderBasket();

  /* ---------- 보관법 ---------- */
  const zoneOf = v => /실온/.test(v.keep) ? "room" : /^냉동/.test(v.keep) ? "freeze" : "cold";
  const ZONES = [
    ["freeze", "냉동실", "-18°C", "한 번 쓸 만큼 나눠 얼려 두면 버릴 일이 없어요."],
    ["cold", "냉장실", "0~5°C", "개봉한 재료는 밀폐해서, 기간 안에 이어 쓰기."],
    ["room", "실온", "서늘한 곳", "빛이 들지 않는 서늘한 곳에 두세요."],
  ];
  $("#store-list").innerHTML = ZONES.map(([z, name, temp, desc]) => `
    <div class="zone z-${z}">
      <h3>${name} <small>${temp}</small></h3>
      <p>${desc}</p>
      <ul class="shelf">${Object.values(INGREDIENTS).filter(v => zoneOf(v) === z).map(v => `
        <li><span class="e" aria-hidden="true">${v.emoji}</span>
          <div><b><span>${esc(v.name)}</span><small>${esc(v.keep)}</small></b><p>${esc(v.store)}</p></div></li>`).join("")}</ul>
    </div>`).join("");

  renderResults();
  fromHash();
})();
