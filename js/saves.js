(function () {
  "use strict";

  var user = MuseumAuth.getCurrentUser();
  var userLabel = document.getElementById("save-page-user");
  var message = document.getElementById("save-page-message");
  var autoSummary = document.getElementById("auto-save-summary");
  var list = document.getElementById("manual-save-list");

  function roomLabel(state) {
    return { dorm: "员工宿舍", hall: "中央大厅", wax: "蜡像馆" }[state && state.roomId] || "未知地点";
  }

  function timeLabel(value) {
    if (!value) return "—";
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? "时间未知" : date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function setMessage(text) {
    message.textContent = text;
  }

  function renderSlot(entry, index, state) {
    var card = document.createElement("article");
    card.className = "save-page-slot" + (entry ? " occupied" : " empty");
    var info = document.createElement("div");
    var title = document.createElement("strong");
    title.textContent = "存档位 " + (index + 1);
    var summary = document.createElement("span");
    summary.textContent = entry ? roomLabel(entry.state) + " · 线索 " + ((entry.state.clues || []).length) : "空存档位";
    var time = document.createElement("small");
    time.textContent = entry ? timeLabel(entry.savedAt) : "—";
    info.appendChild(title);
    info.appendChild(summary);
    info.appendChild(time);

    var actions = document.createElement("div");
    actions.className = "save-page-actions";
    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "button button-small";
    saveButton.textContent = entry ? "覆盖" : "保存";
    saveButton.disabled = !state;
    saveButton.addEventListener("click", function () {
      MuseumState.saveSlot(state, user.id, index);
      setMessage("已保存到存档位 " + (index + 1) + "。");
      render();
    });
    actions.appendChild(saveButton);

    var loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "button button-small";
    loadButton.textContent = "读取";
    loadButton.disabled = !entry;
    loadButton.addEventListener("click", function () {
      MuseumState.save(entry.state, user.id);
      window.location.href = "../index.html?fromSave=1";
    });
    actions.appendChild(loadButton);

    if (entry) {
      var deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "text-button danger-button";
      deleteButton.textContent = "删除";
      deleteButton.addEventListener("click", function () {
        MuseumState.deleteSlot(user.id, index);
        setMessage("已删除存档位 " + (index + 1) + "。");
        render();
      });
      actions.appendChild(deleteButton);
    }

    card.appendChild(info);
    card.appendChild(actions);
    return card;
  }

  function render() {
    if (!user) {
      userLabel.textContent = "未登录";
      autoSummary.textContent = "请先从主页登录。";
      list.textContent = "";
      setMessage("登录后才能查看当前档案的存档。");
      return;
    }

    userLabel.textContent = user.username;
    var state = MuseumState.load(user.id);
    autoSummary.textContent = state ? roomLabel(state) + " · 线索 " + ((state.clues || []).length) + " · 最近保存 " + timeLabel(state.savedAt) : "尚未开始探索";
    list.textContent = "";
    MuseumState.listSlots(user.id).forEach(function (entry, index) {
      list.appendChild(renderSlot(entry, index, state));
    });
  }

  render();
}());
