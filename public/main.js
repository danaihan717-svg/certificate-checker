document.getElementById("checkBtn").addEventListener("click", async () => {
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

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
