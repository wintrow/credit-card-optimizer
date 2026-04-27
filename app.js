const moneyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const state = {
  data: null,
  merchant: "",
  amount: 500
};

function formatTaiwanDateTime(value) {
  if (!value) return "未提供";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  if (isDateOnly) {
    const [year, month, day] = String(value).split("-");
    return `${year}/${month}/${day}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

function isActive(expireDate) {
  if (!expireDate) return true;
  const today = new Date();
  const end = new Date(`${expireDate}T23:59:59`);
  return end >= today;
}

function findMatchedKeywords(merchant, keywords) {
  const normalizedMerchant = (merchant || "").toLowerCase();
  return (keywords || []).filter((keyword) =>
    normalizedMerchant.includes(String(keyword).toLowerCase())
  );
}

function getEffectiveRule(card, merchant) {
  const normalizedMerchant = (merchant || "").toLowerCase();
  const activePlanHints = (card.planHintRules || []).filter((rule) => isActive(rule.expiresAt));
  for (const rule of activePlanHints) {
    const matchedKeywords = findMatchedKeywords(merchant, rule.keywords);
    if (matchedKeywords.length > 0) {
      return {
        rate: rule.rate ?? 0,
        unit: rule.unit || "TWD",
        valuePerUnitTwd: rule.valuePerUnitTwd ?? 1,
        condition: rule.condition || "請依卡片方案使用",
        matchedKeywords
      };
    }
  }
  const activeExceptionRules = (card.noRewardExceptionRules || []).filter((rule) =>
    isActive(rule.expiresAt)
  );
  for (const rule of activeExceptionRules) {
    const requiredKeywords = rule.requiredKeywords || [];
    const matchedAll = requiredKeywords.every((keyword) =>
      normalizedMerchant.includes(String(keyword).toLowerCase())
    );
    if (matchedAll) {
      return {
        rate: rule.rate ?? 0,
        unit: rule.unit || "TWD",
        valuePerUnitTwd: rule.valuePerUnitTwd ?? 1,
        condition: rule.condition || "符合銀行公告例外回饋",
        matchedKeywords: requiredKeywords
      };
    }
  }
  const matchedNoRewardKeywords = findMatchedKeywords(merchant, card.noRewardKeywords);
  if (matchedNoRewardKeywords.length > 0) {
    return {
      rate: 0,
      unit: "TWD",
      valuePerUnitTwd: 1,
      condition: "此通路屬銀行公告不回饋項目",
      matchedKeywords: matchedNoRewardKeywords
    };
  }
  const activeRules = (card.merchantRewards || []).filter((rule) => isActive(rule.expiresAt));
  for (const rule of activeRules) {
    const matchedKeywords = findMatchedKeywords(merchant, rule.keywords);
    if (matchedKeywords.length > 0) {
      return {
        ...rule,
        matchedKeywords
      };
    }
  }
  if (card.id === "taishin-richart-visa") {
    return {
      ...card.baseReward,
      rate: 0.02,
      condition: "假日刷最高2%（未命中其他關鍵字時預設）",
      matchedKeywords: ["假日刷(預設)"]
    };
  }
  return {
    ...card.baseReward,
    matchedKeywords: []
  };
}

function toRewardTwd(amount, rule) {
  const valuePerUnit = rule.valuePerUnitTwd ?? 1;
  return amount * rule.rate * valuePerUnit;
}

function getDisplayCondition(card, rule) {
  const fallback = "依一般回饋";
  if (!rule) return fallback;

  if (card?.id === "esun-unicard-visa" && String(rule.condition || "").includes("任意選")) {
    return "任意選3.5%；UP選4.5%";
  }

  return rule.condition || fallback;
}

function renderTable() {
  const tbody = document.getElementById("resultBody");
  const mobileWrap = document.getElementById("resultCards");
  const meta = document.getElementById("resultMeta");
  const merchant = state.merchant.trim() || "一般消費";
  const amount = Number(state.amount) || 0;

  const rows = state.data.cards
    .map((card) => {
      const rule = getEffectiveRule(card, merchant);
      const rewardTwd = toRewardTwd(amount, rule);
      return { card, rule, rewardTwd };
    })
    .sort((a, b) => b.rewardTwd - a.rewardTwd);

  meta.textContent = `商家：${merchant}｜金額：${moneyFormatter.format(amount)}｜已自動排除過期活動`;
  tbody.innerHTML = rows
    .map((row, index) => {
      const statusClass = row.card.sourceStatus === "official" ? "ok" : "warn";
      const statusText = row.card.sourceStatus === "official" ? "官方頁已驗證" : "部分資料需複核";
      return `
        <tr class="${index === 0 ? "rank-1" : ""}">
          <td>${row.card.name}</td>
          <td>${moneyFormatter.format(row.rewardTwd)}（估）</td>
          <td>${getDisplayCondition(row.card, row.rule)}</td>
          <td>${(row.rule.matchedKeywords || []).join("、") || "-"}</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    })
    .join("");

  mobileWrap.innerHTML = rows
    .map((row, index) => {
      const statusClass = row.card.sourceStatus === "official" ? "ok" : "warn";
      const statusText = row.card.sourceStatus === "official" ? "官方頁已驗證" : "部分資料需複核";
      return `
        <article class="result-card ${index === 0 ? "rank-1-card" : ""}">
          <h3>${index === 0 ? "🏆 " : ""}${row.card.name}</h3>
          <p class="result-amount">${moneyFormatter.format(row.rewardTwd)}（估）</p>
          <p class="result-rule">${getDisplayCondition(row.card, row.rule)}</p>
          <p class="result-rule">符合關鍵字：${(row.rule.matchedKeywords || []).join("、") || "-"}</p>
          <p><span class="badge ${statusClass}">${statusText}</span></p>
        </article>
      `;
    })
    .join("");
}

function renderUpdatedAt() {
  const target = document.getElementById("updatedAt");
  const generatedAt = state.data?.generatedAt;
  target.textContent = `資料更新：${formatTaiwanDateTime(generatedAt)}（台灣時間）`;
}

function renderBenefits() {
  const wrap = document.getElementById("benefitList");
  wrap.innerHTML = state.data.cards
    .map((card) => {
      const activeBenefits = (card.benefits || []).filter((benefit) => isActive(benefit.expiresAt));
      const list = activeBenefits
        .map((benefit) => {
          const tag = benefit.expiresAt ? `（至 ${benefit.expiresAt}）` : "";
          return `<li>${benefit.text}${tag}</li>`;
        })
        .join("");
      const sourceLinks = (card.sourceUrls || [])
        .map(
          (url) =>
            `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        )
        .join("<br>");
      const annualFee = card.annualFee || {
        fee: "依發卡行最新公告",
        waiver: "依發卡行最新公告"
      };
      return `
        <article class="card">
          <h3>${card.name}</h3>
          <ul>${list || "<li>目前無可用優惠資料</li>"}</ul>
          <div class="source-links">
            <strong>年費：</strong>${annualFee.fee}<br>
            <strong>免年費方式：</strong>${annualFee.waiver}
          </div>
          <div class="source-links">
            <strong>來源網址：</strong><br>
            ${sourceLinks || "未提供"}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAirportRules() {
  const target = document.getElementById("airportRules");
  const items = state.data.cards
    .map((card) =>
      (card.airportTransferRules || []).map((rule) => `<li><strong>${card.name}</strong>：${rule}</li>`)
    )
    .flat();
  target.innerHTML = items.join("");
}

function renderFxFees() {
  const target = document.getElementById("fxFees");
  const items = state.data.cards.map((card) => {
    const fee = card.foreignFee || { rate: 0, note: "未提供" };
    const feeText = `${(fee.rate * 100).toFixed(1)}%`;
    return `<li><strong>${card.name}</strong>：${feeText}，${fee.note}</li>`;
  });
  target.innerHTML = items.join("");
}

function bindInputs() {
  const merchantSelect = document.getElementById("merchantSelect");
  const merchantInput = document.getElementById("merchantInput");
  const amountInput = document.getElementById("amountInput");

  merchantSelect.innerHTML = state.data.commonMerchants
    .map((merchant) => `<option value="${merchant}">${merchant}</option>`)
    .join("");
  merchantSelect.value = "一般消費";
  state.merchant = merchantSelect.value;

  merchantSelect.addEventListener("change", (event) => {
    state.merchant = event.target.value;
    if (!merchantInput.value.trim()) {
      renderTable();
    }
  });

  merchantInput.addEventListener("input", (event) => {
    const text = event.target.value.trim();
    state.merchant = text || merchantSelect.value;
    renderTable();
  });

  amountInput.addEventListener("input", (event) => {
    state.amount = Number(event.target.value || 0);
    renderTable();
  });
}

async function init() {
  const response = await fetch("./data/cards.json");
  state.data = await response.json();
  renderUpdatedAt();
  bindInputs();
  renderTable();
  renderBenefits();
  renderAirportRules();
  renderFxFees();
}

init().catch((error) => {
  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `<p>載入資料失敗：${error.message}</p>`;
  }
});
