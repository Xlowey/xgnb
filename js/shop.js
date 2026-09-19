/*
 * 商城（012 §5）。渲染进系统面板给的容器里，自己不弹窗。
 *
 * 三条来路都要守：
 *   1. **扣钱走 MuseumPoints.spend** —— 飘字、收支明细、余额刷新全都自动带上，
 *      商城不许自己改 state.points。
 *   2. **限购按件计数**（state.shopOwned）。012 §5.6 的战斗向是叠加式（买几份叠几层），
 *      所以持有物是"件数"而不是"有没有"。
 *   3. **效果没落点的商品要标出来**，不能让玩家以为花了 300 点买到了什么。
 *      MuseumShopData 里 ready=false 的都会挂一个「效果待接入 · 依赖」的标签。
 *      玩家仍然买得到 —— 012 本来就要求【回滚】和玩法类道具是提前买的。
 *
 * 012 §5.1 那条铁律（第二十八场买任何系统商品 = 选择系统 = 结局 A）现在**没有实现**：
 * 它要挂在「第二十八场」这个场次上，还要区分"买"和"装上"（装上属于玩法类道具的装备系统，
 * 还没做）。不过 state.shopOwned 已经把所有购买都记下了，接的时候直接读它就行。
 */
(function () {
  "use strict";

  var context = null;
  var container = null;
  var activeCategory = null;

  function node(tag, cls, text) {
    var element = document.createElement(tag);
    if (cls) element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function current() { return context && context.getState ? context.getState() : null; }
  function persist() { if (context && context.save) context.save(); }

  function owned() {
    var state = current();
    if (!state) return {};
    if (!state.shopOwned || typeof state.shopOwned !== "object") state.shopOwned = {};
    return state.shopOwned;
  }
  function count(id) { return Math.max(0, Math.round(Number(owned()[id])) || 0); }
  function own(id) { return count(id) > 0; }

  // 买一件。返回 true / false。
  function buy(id) {
    var state = current();
    var item = window.MuseumShopData.find(id);
    if (!state || !item) return false;
    if (count(id) >= item.limit) {
      window.MuseumPoints.notice("已达限购上限：" + item.name);
      return false;
    }
    // 让 spend 去判定余额并飘字；它不成立时会自己给「生存点不足」的提示。
    if (!window.MuseumPoints.spend(item.price, item.name)) return false;
    var ledger = owned();
    ledger[id] = count(id) + 1;
    persist();
    render();
    return true;
  }

  // 消耗一件持有物（【规则豁免】用）。没有就返回 false。
  function consume(id, source) {
    var state = current();
    if (!state || count(id) <= 0) return false;
    var ledger = owned();
    ledger[id] = count(id) - 1;
    if (ledger[id] <= 0) delete ledger[id];
    if (source) window.MuseumPoints.notice("用掉一张" + (window.MuseumShopData.find(id) || { name: id }).name);
    persist();
    render();
    return true;
  }

  function renderItem(item) {
    var held = count(item.id);
    var soldOut = held >= item.limit;
    var card = node("article", "shop-item" + (soldOut ? " is-sold-out" : ""));

    var head = node("div", "shop-item-head");
    head.appendChild(node("h3", "", item.name));
    var price = node("span", "shop-price", String(item.price));
    // ◆ 是 CSS 生成的，读屏拿不到单位，这里补一个可访问名。
    price.setAttribute("aria-label", "单价 " + item.price + " 生存点");
    head.appendChild(price);
    card.appendChild(head);

    card.appendChild(node("p", "shop-note", item.note));

    var foot = node("div", "shop-item-foot");
    foot.appendChild(node("span", "shop-stock", soldOut ? "已满 " + item.limit + "/" + item.limit : "限购 " + item.limit + " · 已购 " + held));
    if (!item.ready) {
      // 效果没落点的，一定让人看得见。
      foot.appendChild(node("span", "shop-tag", "效果待接入" + (item.dep ? " · " + item.dep : "")));
    }
    var buyButton = node("button", "shop-buy", soldOut ? "已售罄" : "购买");
    buyButton.type = "button";
    buyButton.disabled = soldOut;
    buyButton.addEventListener("click", function () { buy(item.id); });
    foot.appendChild(buyButton);
    card.appendChild(foot);
    return card;
  }

  function renderTabs() {
    var nav = node("nav", "shop-tabs");
    nav.setAttribute("aria-label", "商品分类");
    window.MuseumShopData.categories.forEach(function (category) {
      var tab = node("button", "shop-tab", category.label);
      tab.type = "button";
      tab.setAttribute("aria-pressed", String(category.id === activeCategory));
      tab.addEventListener("click", function () { activeCategory = category.id; render(); });
      nav.appendChild(tab);
    });
    return nav;
  }

  function render() {
    if (!container) return;
    var state = current();
    container.textContent = "";
    if (!state) return;

    var categories = window.MuseumShopData.categories;
    if (!activeCategory || !window.MuseumShopData.byCategory(activeCategory)) activeCategory = categories[0].id;
    var category = window.MuseumShopData.byCategory(activeCategory);

    container.appendChild(renderTabs());

    var hint = node("p", "shop-hint", category.hint || "");
    container.appendChild(hint);

    var list = node("div", "shop-list");
    category.items.forEach(function (item) { list.appendChild(renderItem(item)); });
    container.appendChild(list);

    // 012 §3.2 要面板显示生存点；商城这边把"还能买多少"摆出来更直观。
    var foot = node("p", "shop-balance");
    foot.appendChild(node("span", "", "生存点余额"));
    foot.appendChild(node("strong", "", String(window.MuseumPoints.balance())));
    container.appendChild(foot);
  }

  function mount(element) {
    container = element;
    render();
  }
  function unmount() { container = null; }

  function bind(options) { context = options || null; }

  window.MuseumShop = {
    bind: bind,
    mount: mount,
    unmount: unmount,
    render: render,
    buy: buy,
    consume: consume,
    count: count,
    own: own
  };
}());
