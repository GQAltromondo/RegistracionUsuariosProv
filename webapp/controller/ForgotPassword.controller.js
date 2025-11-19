sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast"
], function (Controller, MessageToast) {
  "use strict";

  return Controller.extend("sacde.RegistracionUsuariosProv.controller.ForgotPassword", {

    /* Flecha “atrás” en la barra */
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("Login");
    },

    /* Enviar enlace de reseteo */
    onSendReset: function () {
      const sMail = this.byId("emailForgot").getValue().trim();

      /* Validación súper básica */
      if (!sMail) {
        MessageToast.show("Ingresá un correo válido");
        return;
      }

      // TODO: llamada REST/OData a tu backend
      // fetch("/api/password-reset", { method:"POST", body: JSON.stringify({email:sMail}) })

      MessageToast.show("Si el correo existe, recibirás un enlace para restablecer la contraseña");
      this.byId("emailForgot").setValue("");
    }
  });
});
