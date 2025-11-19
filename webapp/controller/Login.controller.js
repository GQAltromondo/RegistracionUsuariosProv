sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper"
], function (Controller, MessageToast, MessageBox, ModelHelper) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.Login", {

		onInit: function () {
			// Obtiene o crea el modelo loginModel con datos iniciales vacíos
			ModelHelper.getModel(this.getOwnerComponent(), "loginModel", {
				email: "",
				password: ""
			});

			// Obtiene o crea el modelo global usersModel vacío
			ModelHelper.getModel(this.getOwnerComponent(), "usersModel", {});
		},

		login: async function () {
			const oView = this.getView();
			const oComponent = this.getOwnerComponent();
			const oRouter = oComponent.getRouter();

			const loginModel = ModelHelper.getModel(oView, "loginModel");
			const loginData = loginModel.getData();

			try {
				// Hash no se usa luego pero lo dejamos
				// const hashedPassword = await this._hashPassword(loginData.password);

				const oDataModel = oView.getModel("oData");

				const aFilters = [
					new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, loginData.email),
					new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, loginData.password)
				];

				oDataModel.read("/ApplicationLoginSet", {
					filters: aFilters,
					success: () => {
						MessageToast.show("Login exitoso");
						this._getCuitAsociados(loginData.email, loginData.password);
					},
					error: (error) => {
						let errorMessage = "Error desconocido al iniciar sesión.";
						try {
							const parsedError = JSON.parse(error.responseText);
							errorMessage = parsedError.error.message.value || errorMessage;
						} catch (e) {
							// Ignoramos error de parseo y usamos el mensaje por defecto
						}
						MessageBox.error(errorMessage);
					}
				});
			} catch (e) {
				MessageBox.error("Error al procesar la contraseña.");
			}
		},

		_getCuitAsociados: async function (email, password) {
			const oView = this.getView();
			const oComponent = this.getOwnerComponent();
			const oRouter = oComponent.getRouter();
			const oDataModel = oView.getModel("oData");

			const aFilters = [
				new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, email),
				new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, password)
			];

			oDataModel.read("/CuitsAsociadosSet", {
				filters: aFilters,
				success: (oData) => {
					const aResults = oData.results || [];

					const usersModel = ModelHelper.getModel(oComponent, "usersModel");
					usersModel.setProperty("/", aResults);

					oRouter.navTo("TilesView");
				},
				error: () => {
					MessageBox.warning("No se pudieron obtener los CUITs asociados.");
				}
			});
		},

		_hashPassword: async function (password) {
			const encoder = new TextEncoder();
			const data = encoder.encode(password);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		},

		onForgotPassword: function () {
			this.getOwnerComponent().getRouter().navTo("ForgotPwd");
		},

		onRegister: function () {
			this.getOwnerComponent().getRouter().navTo("Register");
		}

	});
});