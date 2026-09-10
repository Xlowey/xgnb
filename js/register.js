(function () {
  "use strict";

  var form = document.getElementById("register-page-form");
  var message = document.getElementById("register-page-message");
  var params = new URLSearchParams(window.location.search);
  var requestedNext = params.get("next");
  var next = ["story", "newGame", "game"].indexOf(requestedNext) !== -1 ? requestedNext : "";

  if (!form || !message) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var password = document.getElementById("register-page-password").value;
    var passwordAgain = document.getElementById("register-page-password-again").value;
    if (password !== passwordAgain) {
      message.textContent = "两次口令不一致。";
      return;
    }

    var result = MuseumAuth.register(document.getElementById("register-page-username").value, password);
    if (!result.ok) {
      message.textContent = result.message;
      return;
    }

    if (next === "story") window.location.href = "story.html?flow=start";
    else if (next === "newGame") window.location.href = "../index.html?newGame=1";
    else window.location.href = "../index.html";
  });
}());
