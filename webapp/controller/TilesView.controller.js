sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/routing/History",
	"sap/m/MessageToast",
	"sap/m/Dialog",
	"sap/m/Button",
	"sap/m/Label",
	"sap/m/Input",
	"sap/m/VBox",
	"sap/ui/core/Fragment",
	"sacde/RegistracionUsuariosProv/utils/Validations"
], function (Controller, History, MessageToast, Dialog, Button, Label, Input, VBox, Fragment, Validations) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.TilesView", {

		onInit: function () {
			const oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("TilesView").attachPatternMatched(this._onRouteMatched, this);

		},

		onNavBack: function () {
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				UIComponent.getRouterFor(this).navTo("Main", {}, /*noHistory*/ true);
			}
		},
		_onRouteMatched: function () {
			this.byId("cuitComboBox").setSelectedKey("")
			const oUserModel = this.getOwnerComponent().getModel("usersModel");
			const oData = oUserModel.getData();

			// Validar si hay datos de usuario
			if (!oData ||
				(Array.isArray(oData) && oData.length === 0) ||
				(typeof oData === "object" && !Array.isArray(oData) && Object.keys(oData).length === 0)) {
				this.getOwnerComponent().getRouter().navTo("Login");
				return;
			}

			this.getView().setModel(oUserModel);

			this.onCuitChange()
				// Preparar modelos adicionales para la vista
			this._prepararModelosUsuario(oUserModel);
		},

		_prepararModelosUsuario: function (oUserModel) {
			const oUsuario = oUserModel.getData();

			if (!oUsuario) {
				MessageToast.show("Sesión expirada. Redirigiendo al login...");
				this.getOwnerComponent().getRouter().navTo("Login");
				return;
			}

			// Modelo con datos del usuario actual para la vista
			const oUsuarioModel = new sap.ui.model.json.JSONModel(oUsuario);
			this.getView().setModel(oUsuarioModel, "usuarioActual");

			if (!Array.isArray(oUsuario)) {
				return; // Si no es array, no continúa con lógica de admins
			}

			// Filtrar usuarios admin
			const aAdmins = oUsuario.filter(user => user.adminUser === "X");

			// Map para usuarios únicos por CUIT
			const mapUnicos = new Map();
			aAdmins.forEach(user => {
				if (!mapUnicos.has(user.cuit)) {
					mapUnicos.set(user.cuit, {
						cuit: user.cuit,
						razonSocial: user.razonSocial
					});
				}
			});
			const aAdminCuits = Array.from(mapUnicos.values());

			// Modelo para CUITs admin
			const oAdminCuitsModel = new sap.ui.model.json.JSONModel(aAdminCuits);
			this.getView().setModel(oAdminCuitsModel, "AdminCuitsModel");

			// Agrupar usuarios no admin por CUIT admin
			const mUsuariosPorCuit = {};
			oUsuario.forEach(user => {
				if (user.adminUser === "" && aAdminCuits.some(item => item.cuit === user.cuit)) {
					if (!mUsuariosPorCuit[user.cuit]) {
						mUsuariosPorCuit[user.cuit] = [];
					}
					mUsuariosPorCuit[user.cuit].push(user);
				}
			});
			const oUsuariosPorCuitModel = new sap.ui.model.json.JSONModel(mUsuariosPorCuit);
			this.getView().setModel(oUsuariosPorCuitModel, "UsuariosPorCuitModel");

			// Para ComboBox CUITs asociados - visual
			const aCuitsAsociados = aAdminCuits.map(cuit => ({
				key: cuit.cuit,
				text: cuit.razonSocial
			}));
			oUserModel.setProperty("/cuitsAsociados", aCuitsAsociados);
		},

		onTileCreateUserPress: function () {
			this.getOwnerComponent().getRouter().navTo("Main");
		},

		// onTileRegProvee: function () {
		// window.open( "https://registracionproveedores-nlf6u6854p.dispatcher.br1.hana.ondemand.com/?hc_reset")

		// },

		// onTilePortalPress: function () {
		// 	window.open("https://flpnwc-nlf6u6854p.dispatcher.br1.hana.ondemand.com/sites/PortalProveedoresSACDE#Shell-home");
		// },
		onTileRegProvee: function () {
			const sCuit = this.byId("cuitComboBox").getSelectedKey();

			if (!sCuit) {
				sap.m.MessageToast.show("Seleccione un CUIT antes de continuar.");
				return;
			}

			const sUrl =
				`https://registracionproveedores-goio5drrj1.dispatcher.br1.hana.ondemand.com/?CUIT=${encodeURIComponent(sCuit)}&hc_reset`;
			window.open(sUrl, "_blank");
		},

		onTilePortalPress: function () {
			window.open("https://flpnwc-goio5drrj1.dispatcher.br1.hana.ondemand.com/sites/portalproveedoressacde#Shell-home");
		},

		onCuitChange: function () {
			const oView = this.getView();
			const sCuit = this.byId("cuitComboBox").getSelectedKey()
			if (sCuit === "") {
				oView.byId("tileUsuarios").setVisible(false);
				oView.byId("tilePortal").setVisible(false);
				oView.byId("tileRegProvee").setVisible(false)
				return
			}
			const sPais = "AR";

			localStorage.setItem("selectedCuit", sCuit);

			const aFilters = [
				new sap.ui.model.Filter("Pais", sap.ui.model.FilterOperator.EQ, sPais),
				new sap.ui.model.Filter("Cuit", sap.ui.model.FilterOperator.EQ, sCuit)
			];

			const oDataModel = this.getOwnerComponent().getModel("oData");
			oDataModel.setUseBatch(false);

			oDataModel.read("/DatosGeneralesSet", {
				filters: aFilters,
				success: (oData) => {
					const aResults = oData.results || [];
					const oUserModel = new sap.ui.model.json.JSONModel(aResults);

					oView.setModel(oUserModel, "dataUser");

					oView.byId("tileUsuarios").setVisible(true);

					if (aResults.length > 0 && aResults[0].Estado === "A") {
						oView.byId("tilePortal").setVisible(true);
						oView.byId("tileRegProvee").setVisible(false);
					} else {
						oView.byId("tilePortal").setVisible(false);
						oView.byId("tileRegProvee").setVisible(true);
					}
				},
				error: (error) => {
					console.error("Error al cargar datos generales:", error);
				}
			});
		},
		newSociety: async function () {
			if (!this._pNewSocietyDialog) {
				this._pNewSocietyDialog = Fragment.load({
					id: this.getView().getId(),
					name: "sacde.RegistracionUsuariosProv.fragments.NewSocietyDialog",
					controller: this
				}).then((oDialog) => {
					this.getView().addDependent(oDialog);
					return oDialog;
				});
			}

			const oDialog = await this._pNewSocietyDialog;

			this.byId("newSocCuitInput").setValue("");
			this.byId("newSocRazonInput").setValue("");

			oDialog.open();
		},

		onNewSocietyCancel: async function () {
			const oDialog = await this._pNewSocietyDialog;
			oDialog.close();
		},

		onNewSocietySave: async function () {
			const oInputCuit = this.byId("newSocCuitInput");
			const sCuit = oInputCuit.getValue().trim();
			const sRazon = this.byId("newSocRazonInput").getValue().trim();

			// Validar CUIT usando la validación existente
			const oValidation = Validations.isValidCuit(sCuit);
			if (!oValidation.valid) {
				oInputCuit.setValueState("Error");
				oInputCuit.setValueStateText(oValidation.text);
				MessageToast.show(oValidation.text);
				return;
			}
			
			if (!sRazon) {
				MessageToast.show("Ingresá la Razón Social.");
				return;
			}

			console.log("Nueva sociedad:", {
				cuit: sCuit,
				razonSocial: sRazon
			});

			const oDialog = await this._pNewSocietyDialog;
			oDialog.close();
		},

		onNewSocietyCuitLiveChange: function (oEvent) {
			const oInput = oEvent.getSource();
			const sValue = (oEvent.getParameter("value") || "").replace(/\D/g, "");
			
			// Actualizar valor solo con números
			oInput.setValue(sValue);
			
			// Validar CUIT usando la validación existente
			const oValidation = Validations.isValidCuit(sValue);
			
			if (!oValidation.valid) {
				oInput.setValueState("Error");
				oInput.setValueStateText(oValidation.text);
			} else {
				oInput.setValueState("Success");
				oInput.setValueStateText("");
			}
		},

	});
});