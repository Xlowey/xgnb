(function () {
  "use strict";

  var form = document.getElementById("register-page-form");
  var message = document.getElementById("register-page-message");

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

    window.location.href = "../index.html";
  });
}());
