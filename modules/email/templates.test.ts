import { describe, expect, it } from "vitest";

import { appointmentReminderEmail, bookingConfirmationEmail, dailySummaryEmail, passwordResetEmail, verificationEmail } from "./templates";

const booking = {
  businessName: "Peluquería <Lola>",
  customerName: "Ana <script>alert(1)</script>",
  serviceName: "Corte",
  date: "2030-06-10",
  startTime: "10:00",
};

describe("templates de email", () => {
  it("la confirmación incluye negocio, servicio, fecha y hora, y escapa HTML", () => {
    const email = bookingConfirmationEmail(booking);
    expect(email.subject).toContain("Tu turno está confirmado");
    expect(email.html).toContain("Corte");
    expect(email.html).toContain("10:00 hs");
    expect(email.html).toContain("Peluquería &lt;Lola&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("Servicio: Corte");
  });

  it("con seña avisa que falta el pago y muestra el monto", () => {
    const email = bookingConfirmationEmail({ ...booking, pendingPayment: true, depositAmount: 5000, totalAmount: 20000 });
    expect(email.subject).toContain("Recibimos tu reserva");
    expect(email.html).toContain("Seña a abonar");
  });

  it("el recordatorio dice cuánto falta según la anticipación", () => {
    expect(appointmentReminderEmail(booking, 30).subject).toContain("en 30 minutos");
    expect(appointmentReminderEmail(booking, 60).subject).toContain("en 1 hora");
  });

  it("el resumen diario indica cantidad, primer y último horario", () => {
    const email = dailySummaryEmail({
      businessName: "Lola",
      date: "2030-06-10",
      appointments: [
        { startTime: "09:00", endTime: "10:00", customerName: "Ana", serviceName: "Corte" },
        { startTime: "11:00", endTime: "12:00", customerName: "Beto", serviceName: "Color" },
        { startTime: "17:00", endTime: "18:00", customerName: "Cami", serviceName: "Corte", pendingPayment: true },
      ],
    });
    expect(email.html).toContain("3 turnos");
    expect(email.html).toContain("Primero a las 09:00 hs");
    expect(email.html).toContain("Último a las 17:00 hs");
    expect(email.html).toContain("pendiente de pago");
  });

  it("sin turnos igual genera un resumen que lo dice", () => {
    const email = dailySummaryEmail({ businessName: "Lola", date: "2030-06-10", appointments: [] });
    expect(email.html).toContain("No tenés turnos agendados para hoy");
    expect(email.text).toContain("No tenés turnos agendados para hoy");
  });

  it("el email de verificación tiene botón, enlace de respaldo y texto plano", () => {
    const url = "https://app.test/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard";
    const email = verificationEmail({ name: "Lucía <b>", url });
    expect(email.subject).toContain("Confirmá tu email");
    expect(email.html).toContain("Confirmar mi email");
    expect(email.html).toContain("token=abc&amp;callbackURL");
    expect(email.html).not.toContain("<b>");
    expect(email.text).toContain(url);
  });

  it("el email de recuperación aclara que vence y es de un solo uso", () => {
    const email = passwordResetEmail({ name: "Lucía", url: "https://app.test/reset/xyz", expiresInMinutes: 60 });
    expect(email.subject).toContain("Restablecé tu contraseña");
    expect(email.text).toContain("un solo uso");
    expect(email.text).toContain("60 minutos");
    expect(email.html).toContain("https://app.test/reset/xyz");
  });
});
