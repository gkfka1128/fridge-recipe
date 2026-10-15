(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const won = n => (Math.round(n / 10) * 10).toLocaleString("ko-KR") + "원";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const byId = Object.fromEntries(RECIPES.map(r => [r.id, r]));

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
    $("#summary").textContent = none
      ? `전체 레시피 ${list.length}개 — 재료를 고르면 지금 만들 수 있는 것부터 보여 드려요.`
      : `지금 바로 만들 수 있는 레시피 ${readyN}개 · 재료를 조금 더 사면 되는 레시피 ${list.length - readyN}개`;

    $("#results").innerHTML = list.length ? list.map(({ r, missing }) => {
      const badge = none ? ""
        : missing.length === 0 ? `<span class="badge ok">지금 바로 가능</span>`
        : `<span class="badge ${missing.length <= 2 ? "need" : "far"}">${missing.map(k => INGREDIENTS[k].name).join(", ")} 필요</span>`;
      return `<button type="button" class="card" data-id="${r.id}">
        ${badge}
        <div class="emo" aria-hidden="true">${r.ing.map(([k]) => INGREDIENTS[k].emoji).join("")}</div>
        <h3>${esc(r.name)}</h3>
        <div class="meta"><span>⏱ ${r.time}분</span><span>${r.level}</span><span>${r.tool}</span></div>
        <div class="price"><span>재료비</span><b>${won(cost(r))}</b><s>배달 ${won(r.delivery.price)}</s></div>
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
      <div class="d-head">
        <div><p class="eyebrow">${r.ing.map(([k]) => INGREDIENTS[k].emoji).join(" ")}</p><h2 id="d-title">${esc(r.name)}</h2></div>
        <button type="button" class="close" aria-label="닫기">×</button>
      </div>
      <div class="facts">
        <div><small>조리 시간</small><b>${r.time}분</b></div>
        <div><small>난이도</small><b>${r.level}</b></div>
        <div><small>도구</small><b>${r.tool}</b></div>
        <div><small>1인분 재료비</small><b>${won(c)}</b></div>
      </div>

      <div class="d-sec">
        <h3>재료 (1인분)</h3>
        <ul class="ing">${r.ing.map(([k, amt]) => {
          const v = INGREDIENTS[k];
          return `<li><span>${v.emoji}</span><span class="nm">${esc(v.name)}</span><span class="amt">${esc(amt)}</span>
            ${picked.has(k) ? `<span class="have">있음</span>` : ""}
            <span class="buy" title="${esc(v.pack)} · 약 ${won(v.price)}">소포장 ${esc(v.pack)} ${buyLinks(k)}</span></li>`;
        }).join("")}</ul>
        <p class="sauce"><b>양념</b> ${esc(r.sauce)}</p>
      </div>

      <div class="d-sec">
        <h3>만드는 법</h3>
        <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      </div>

      ${r.leftover.length ? `<div class="d-sec">
        <h3>남은 재료 이어 쓰기</h3>
        <div class="chain">${r.leftover.map(([k, what, next]) => byId[next] ? `
          <button type="button" data-next="${next}">
            <span>${INGREDIENTS[k].emoji} ${esc(what)} 남았다면</span><span class="arrow">→</span><b>${esc(byId[next].name)}</b>
          </button>` : "").join("")}</div>
      </div>` : ""}

      <div class="d-sec d-cmp">
        <h3>배달과 비교하면</h3>
        <div class="cmp">
          <div class="bar home"><span>집밥</span><div class="track"><div class="fill" style="width:${Math.max(4, c / d * 100)}%"></div></div><b>${won(c)}</b></div>
          <div class="bar deli"><span>배달</span><div class="track"><div class="fill" style="width:100%"></div></div><b>${won(d)}</b></div>
        </div>
        <p class="save" style="margin:8px 0 0">한 끼에 ${won(d - c)} 절약</p>
        <p class="left" style="margin:2px 0 0">배달: ${esc(r.delivery.name)} (배달팁 포함 예상가)</p>
      </div>

      <div class="d-sec">
        <h3>재료 보관 팁</h3>
        <ul class="ing">${r.ing.map(([k]) => {
          const v = INGREDIENTS[k];
          return `<li><span>${v.emoji}</span><span class="nm">${esc(v.name)}</span><span class="amt">${esc(v.store)} (${esc(v.keep)})</span></li>`;
        }).join("")}</ul>
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
    return { made, buy, deli, left };
  }

  $("#baskets").innerHTML = BASKETS.map(b => {
    const p = planBasket(b.items);
    if (!p.made.length) return "";
    const max = Math.max(p.buy, p.deli);
    return `<article class="bk">
      <h3>${esc(b.name)}</h3>
      <div class="items">${b.items.map(k => INGREDIENTS[k].emoji + " " + esc(INGREDIENTS[k].name)).join(" · ")}</div>
      <div><b>${p.made.length}끼</b> 해결
        <ol>${p.made.map(r => `<li><a href="#recipe=${r.id}">${esc(r.name)}</a></li>`).join("")}</ol></div>
      <div class="cmp">
        <div class="bar home"><span>장보기</span><div class="track"><div class="fill" style="width:${p.buy / max * 100}%"></div></div><b>${won(p.buy)}</b></div>
        <div class="bar deli"><span>배달 ${p.made.length}번</span><div class="track"><div class="fill" style="width:${p.deli / max * 100}%"></div></div><b>${won(p.deli)}</b></div>
      </div>
      <div class="save">${won(p.deli - p.buy)} 절약 · 한 끼 ${won(p.buy / p.made.length)}</div>
      ${p.left.length ? `<div class="left">아직 남은 재료: ${p.left.join(", ")} — 다음 주에 이어서!</div>` : ""}
    </article>`;
  }).join("");

  /* ---------- 보관법 ---------- */
  $("#store-list").innerHTML = Object.values(INGREDIENTS).map(v =>
    `<div class="st"><h3><span>${v.emoji} ${esc(v.name)}</span><small>${esc(v.keep)}</small></h3><p>${esc(v.store)}</p></div>`
  ).join("");

  renderResults();
  fromHash();
})();
