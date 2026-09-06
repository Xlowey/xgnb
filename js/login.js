(function () {
  "use strict";

  var form = document.getElementById("login-page-form");
  var message = document.getElementById("login-page-message");
  var registerLink = document.getElementById("login-register-link");
  var params = new URLSearchParams(window.location.search);
  var next = params.get("next") === "story" ? "story" : "";

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
    window.location.href = next === "story" ? "story.html?flow=start" : "../index.html";
  });
}());
