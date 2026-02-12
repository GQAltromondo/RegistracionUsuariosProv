sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper"
], function (BaseController, MessageToast, MessageBox, ModelHelper) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.Login", {

		onInit: function () {
			// Obtiene o crea el modelo loginModel con datos iniciales vacíos
			ModelHelper.getModel(this.getOwnerComponent(), "loginModel", {
				email: "",
				password: ""
			});

			// Obtiene o crea el modelo global usersModel vacío
			ModelHelper.getModel(this.getOwnerComponent(), "usersModel", {});
		},

		login: function () {
			const oView = this.getView();
			const loginModel = ModelHelper.getModel(oView, "loginModel");
			const loginData = loginModel.getData();

			const oDataModel = oView.getModel("oData");

			const aFilters = [
				new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, loginData.email),
				new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, loginData.password)
			];

			this.showBusy();

			oDataModel.read("/ApplicationLoginSet", {
				filters: aFilters,
				success: () => {
					MessageToast.show("Login exitoso");
					this._getCuitAsociados(loginData.email, loginData.password);
				},
				error: (oError) => {
					this.hideBusy();
					const sMsg = this.parseError(oError, "Error desconocido al iniciar sesión.");
					MessageBox.error(sMsg);
				}
			});
		},

		_getCuitAsociados: function (email, password) {
			const oComponent = this.getOwnerComponent();
			const oDataModel = this.getView().getModel("oData");

			const aFilters = [
				new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, email),
				new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, password)
			];

			oDataModel.read("/CuitsAsociadosSet", {
				filters: aFilters,
				success: (oData) => {
					this.hideBusy();
					const aResults = oData.results || [];

					const usersModel = ModelHelper.getModel(oComponent, "usersModel");
					usersModel.setProperty("/", aResults);

					this.navTo("TilesView");
				},
				error: () => {
					this.hideBusy();
					MessageBox.warning("No se pudieron obtener los CUITs asociados.");
				}
			});
		},

		onForgotPassword: function () {
			this.navTo("ForgotPwd");
		},

		onRegister: function () {
			this.navTo("Register");
		}

	});
});