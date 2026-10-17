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
  // 배달 가격 = 식당 메뉴 평균 + 배달팁
  for (const r of RECIPES) if (r.delivery.menu) r.delivery.price = r.delivery.menu + DELIVERY_TIP;

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
  const offPct = r => Math.round((1 - cost(r) / r.delivery.price) * 100);

  // 히어로 숫자 — 모두 data.js 에서 계산
  const avgCost = RECIPES.reduce((s, r) => s + cost(r), 0) / RECIPES.length;
  const avgOff = Math.round(RECIPES.reduce((s, r) => s + offPct(r), 0) / RECIPES.length);
  $("#stats").innerHTML = `
    <div><dt>자취방 레시피</dt><dd>${RECIPES.length}개</dd></div>
    <div><dt>평균 1인분 재료비</dt><dd>${won(avgCost)}</dd></div>
    <div><dt>배달보다 평균</dt><dd class="save">${avgOff}% 절약</dd></div>`;

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
          <div class="price"><span class="num">${won(cost(r))}</span><s>배달 ${won(r.delivery.price)}</s><span class="off">-${offPct(r)}%</span></div>
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
    const c = cost(r), d = r.delivery.price;
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
          <h3>배달과 비교하면</h3>
          <div class="receipt">
            <div class="rc-sec">
              <p class="rc-label">집밥 1인분</p>
              ${r.ing.map(([k, amt, use]) => `<div class="rc-row"><span>${esc(INGREDIENTS[k].name)} ${esc(amt)}</span><span class="num">${won(INGREDIENTS[k].price * use)}</span></div>`).join("")}
              <div class="rc-row rc-total"><span>합계</span><span class="num">${won(c)}</span></div>
            </div>
            <div class="rc-sec">
              <div class="rc-row rc-total"><span>배달 · ${esc(r.delivery.name)}</span><span class="num">${won(d)}</span></div>
              <p class="rc-left" style="margin-top:2px">${r.delivery.menu
                ? `메뉴 ${won(r.delivery.menu)} (백석대 근처 식당 ${r.delivery.stores}곳 평균) + 배달팁 ${won(DELIVERY_TIP)}`
                : "근처에 같은 메뉴가 없어 추정한 가격 (배달팁 포함)"}</p>
            </div>
            <div class="rc-sec rc-save"><span>한 끼에 아끼는 돈</span><b>${won(d - c)}</b></div>
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

  /* ---------- 장바구니 ---------- */
  function planBasket(items) {
    const set = new Set(items);
    const stock = Object.fromEntries(items.map(k => [k, k === "rice" ? Infinity : 1]));
    const made = [];
    let riceUsed = 0;
    // 재료를 많이 쓰는 레시피부터 채워야 장바구니 재료가 골고루 소진된다
    for (const r of [...RECIPES].sort((a, b) => b.ing.length - a.ing.length)) {
      if (!r.ing.every(([k, , use]) => set.has(k) && stock[k] >= use - 1e-9)) continue;
      r.ing.forEach(([k, , use]) => { stock[k] -= use; if (k === "rice") riceUsed += use; });
      made.push(r);
    }
    const buy = items.filter(k => k !== "rice").reduce((s, k) => s + INGREDIENTS[k].price, 0)
      + riceUsed * INGREDIENTS.rice.price;
    const deli = made.reduce((s, r) => s + r.delivery.price, 0);
    const left = items.filter(k => k !== "rice" && stock[k] > 0.05)
      .map(k => `${INGREDIENTS[k].name} ${Math.round(stock[k] * 100)}%`);
    return { made, buy, deli, left, riceUsed };
  }

  $("#baskets").innerHTML = BASKETS.map(b => {
    const p = planBasket(b.items);
    if (!p.made.length) return "";
    return `<article class="receipt">
      <div class="rc-head"><small>SHOPPING RECEIPT</small><h3>${esc(b.name)}</h3></div>
      <div class="rc-sec">
        <p class="rc-label">장보기</p>
        ${b.items.filter(k => k !== "rice").map(k => `<div class="rc-row"><span>${INGREDIENTS[k].emoji} ${esc(INGREDIENTS[k].name)} ${esc(INGREDIENTS[k].pack)}${INGREDIENTS[k].src ? ` <small class="src">${esc(INGREDIENTS[k].src)}</small>` : ""}</span><span class="num">${won(INGREDIENTS[k].price)}</span></div>`).join("")}
        <div class="rc-row"><span>${INGREDIENTS.rice.emoji} 밥 ${p.riceUsed}공기</span><span class="num">${won(p.riceUsed * INGREDIENTS.rice.price)}</span></div>
        <div class="rc-row rc-total"><span>합계</span><span class="num">${won(p.buy)}</span></div>
      </div>
      <div class="rc-sec">
        <p class="rc-label">이걸로 만드는 ${p.made.length}끼</p>
        ${p.made.map(r => `<div class="rc-row"><a href="#recipe=${r.id}">${esc(r.name)}</a><s class="num">${won(r.delivery.price)}</s></div>`).join("")}
        <div class="rc-row rc-total"><span>배달로 시키면</span><span class="num">${won(p.deli)}</span></div>
      </div>
      <div class="rc-sec">
        <div class="rc-save"><span>${p.made.length}끼에 아끼는 돈</span><b>${won(p.deli - p.buy)}</b></div>
        <p class="rc-left">한 끼 ${won(p.buy / p.made.length)}${p.left.length ? ` · 남은 재료: ${p.left.join(", ")}` : ""}</p>
      </div>
    </article>`;
  }).join("");

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
