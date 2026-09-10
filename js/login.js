(function () {
  "use strict";

  var form = document.getElementById("login-page-form");
  var message = document.getElementById("login-page-message");
  var registerLink = document.getElementById("login-register-link");
  var params = new URLSearchParams(window.location.search);
  var requestedNext = params.get("next");
  var next = ["story", "newGame", "game"].indexOf(requestedNext) !== -1 ? requestedNext : "";

  if (registerLink && next) {
    registerLink.href = "register.html?next=" + encodeURIComponent(next);
  }
  if (!form || !message) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var result = MuseumAuth.login(
      document.getElementById("login-page-username").value,
      document.getElementById("login-page-password").value
    );
    if (!result.ok) {
      message.textContent = result.message;
      return;
    }
    if (next === "story") window.location.href = "story.html?flow=start";
    else if (next === "newGame") window.location.href = "../index.html?newGame=1";
    else window.location.href = "../index.html";
  });
}());
