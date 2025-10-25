// --- Проверка сертификата (index.html) ---
document.addEventListener("DOMContentLoaded", () => {
  const checkBtn = document.getElementById("checkBtn");
  if (checkBtn) {
    checkBtn.addEventListener("click", async () => {
      const number = document.getElementById("certNumber").value.trim();
      const result = document.getElementById("result");
      result.textContent = "";

      if (!number) {
        result.textContent = "Введите номер сертификата";
        return;
      }

      try {
        const res = await fetch(`/api/check/${encodeURIComponent(number)}`);
        const data = await res.json();
        if (data.success) {
          const c = data.cert;
          result.innerHTML = `
            <div>
              <strong>ФИО:</strong> ${escapeHtml(c.fio)}<br>
              <strong>Курс:</strong> ${escapeHtml(c.course)}<br>
              <strong>Дата выдачи:</strong> ${escapeHtml(c.date)}<br>
              <strong>Организация:</strong> ${escapeHtml(c.org)}<br>
              <strong>Номер:</strong> ${escapeHtml(c.number)}
            </div>`;
        } else {
          result.textContent = data.message || "Сертификат не найден";
        }
      } catch (err) {
        result.textContent = "Ошибка подключения к серверу";
        console.error("check error:", err);
      }
    });
  }

  // --- Авторизация (admin.html / editor.html) ---
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const login = document.getElementById("login").value.trim();
      const password = document.getElementById("password").value.trim();
      const msg = document.getElementById("msg");
      msg.textContent = "";

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login, password }),
        });

        if (!res.ok) {
          msg.textContent = "Ошибка соединения с сервером";
          return;
        }

        const data = await res.json();
        if (data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("role", data.role);

          if (data.role === "admin") {
            window.location.href = "admin.html";
          } else if (data.role === "editor") {
            window.location.href = "editor.html";
          } else {
            msg.textContent = "Неизвестная роль пользователя";
          }
        } else {
          msg.textContent = data.message || "Неверный логин или пароль";
        }
      } catch (err) {
        msg.textContent = "Ошибка соединения с сервером";
        console.error(err);
      }
    });
  }

  // --- Проверка авторизации при открытии admin.html или editor.html ---
  const page = window.location.pathname;
  if (page.includes("admin.html") || page.includes("editor.html")) {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || !role) {
      window.location.href = "index.html";
      return;
    }

    if (page.includes("admin.html") && role !== "admin") {
      alert("Нет доступа");
      window.location.href = "index.html";
      return;
    }

    if (page.includes("editor.html") && role !== "editor" && role !== "admin") {
      alert("Нет доступа");
      window.location.href = "index.html";
      return;
    }
  }
});

// --- Безопасный вывод текста ---
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}
