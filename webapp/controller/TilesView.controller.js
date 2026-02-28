sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/Fragment",
	"sacde/RegistracionUsuariosProv/utils/Validations",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper",
	"sacde/RegistracionUsuariosProv/utils/IASHelper"
], function (BaseController, MessageToast, MessageBox, Fragment, Validations, ModelHelper, IASHelper) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.TilesView", {

		onInit: function () {
			this.getRouter().getRoute("TilesView").attachPatternMatched(this._onRouteMatched, this);
		},
			_onRouteMatched: function () {
			this.byId("cuitComboBox").setSelectedKey("");
			const oUserModel = this.getOwnerComponent().getModel("usersModel");
			const oData = oUserModel.getData();

			// Validar si hay datos de usuario
			if (!oData ||
				(Array.isArray(oData) && oData.length === 0) ||
				(typeof oData === "object" && !Array.isArray(oData) && Object.keys(oData).length === 0)) {
				this.navTo("Login");
				return;
			}

			this.getView().setModel(oUserModel);
			this.onCuitChange();
			
			// Preparar modelos adicionales para la vista
			this._prepararModelosUsuario(oUserModel);
		},

		_prepararModelosUsuario: function (oUserModel) {
			const oUsuario = oUserModel.getData();

			if (!oUsuario) {
				MessageToast.show("Sesión expirada. Redirigiendo al login...");
				this.navTo("Login");
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
			this.navTo("Main");
		},

		onTileRegProvee: function () {
			const sCuit = this.byId("cuitComboBox").getSelectedKey();

			if (!sCuit) {
				MessageToast.show("Seleccione un CUIT antes de continuar.");
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
			const sCuit = this.byId("cuitComboBox").getSelectedKey();
			
			if (sCuit === "") {
				oView.byId("tileUsuarios").setVisible(false);
				oView.byId("tilePortal").setVisible(false);
				oView.byId("tileRegProvee").setVisible(false);
				return;
			}
			
			// Obtener país del usuario logueado
			const oUsersModel = this.getOwnerComponent().getModel("usersModel");
			const aUsers = oUsersModel.getData();
			const oAdminUser = Array.isArray(aUsers) ? aUsers.find(user => user.adminUser === "X") : null;
			const sPais = (oAdminUser && oAdminUser.pais) || "AR";

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
				error: (oError) => {
					jQuery.sap.log.error("Error al cargar datos generales:", oError);
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

			// Limpiar campos y estados
			const oInputCuit = this.byId("newSocCuitInput");
			const oInputRazon = this.byId("newSocRazonInput");
			
			oInputCuit.setValue("");
			oInputCuit.setValueState("None");
			oInputRazon.setValue("");
			oInputRazon.setValueState("None");

			oDialog.open();
		},

		onNewSocietyCancel: async function () {
			const oDialog = await this._pNewSocietyDialog;
			oDialog.close();
		},

		onNewSocietySave: async function () {
			const oInputCuit = this.byId("newSocCuitInput");
			const oInputRazon = this.byId("newSocRazonInput");
			const sCuit = oInputCuit.getValue().trim();
			const sRazon = oInputRazon.getValue().trim();

			// Validar CUIT usando la validación existente
			const oValidation = Validations.isValidCuit(sCuit);
			if (!oValidation.valid) {
				oInputCuit.setValueState("Error");
				oInputCuit.setValueStateText(oValidation.text);
				MessageToast.show(oValidation.text);
				return;
			}
			
			if (!sRazon) {
				oInputRazon.setValueState("Error");
				oInputRazon.setValueStateText("Campo obligatorio");
				MessageToast.show("Ingresá la Razón Social.");
				return;
			}

			// Obtener datos del usuario logueado
			const oUsersModel = this.getOwnerComponent().getModel("usersModel");
			const aUsers = oUsersModel.getData();
			
			// Buscar el primer usuario admin para obtener sus datos
			const oAdminUser = Array.isArray(aUsers) 
				? aUsers.find(user => user.adminUser === "X") 
				: null;

			if (!oAdminUser) {
				MessageBox.error("No se encontraron datos del usuario logueado.");
				return;
			}

			// Armar payload con datos del usuario logueado + nueva sociedad (contrasena vacía - login vía IAS)
			const oNewSociety = {
				usuario: oAdminUser.usuario,
				pais: oAdminUser.pais || "AR",
				email: oAdminUser.email,
				contrasena: "",
				cuit: sCuit,
				razon_soc: sRazon,
				admin: "X"
			};

			// Crear registro en backend
			const oModel = this.getOwnerComponent().getModel("oData");
			const sEntitySet = "/ApplicationLoginSet";

			this.showBusy();

			oModel.create(sEntitySet, oNewSociety, {
				success: async (oData, response) => {
					// Crear usuario en IAS como admin
					try {
						await IASHelper.createUser({
							email: oAdminUser.email,
							nombre: oAdminUser.usuario,
							pais: oAdminUser.pais || "AR"
						}, true); // true = es admin
					} catch (e) {
						// IASHelper ya muestra el error
					}

					this.hideBusy();
					MessageToast.show("Sociedad agregada exitosamente.");
					
					// Cerrar diálogo y limpiar campos
					this._pNewSocietyDialog.then((oDialog) => {
						oDialog.close();
						oInputCuit.setValue("");
						oInputCuit.setValueState("None");
						oInputRazon.setValue("");
						oInputRazon.setValueState("None");
					});

					// Refrescar CUITs y seleccionar el nuevo
					await this._refreshCuitsAsociados(sCuit);
				},
				error: (oError) => {
					this.hideBusy();
					const sMsg = this.parseError(oError, "Error al crear la sociedad.");
					MessageBox.error(sMsg);
				}
			});
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

		_refreshCuitsAsociados: function (sCuitToSelect) {
			return new Promise((resolve, reject) => {
				const oLoginData = this.getOwnerComponent().getModel("loginModel").getData();
				const oDataModel = this.getOwnerComponent().getModel("oData");

				const aFilters = [
					new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, oLoginData.email),
					new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, oLoginData.password)
				];

				oDataModel.read("/CuitsAsociadosSet", {
					filters: aFilters,
					success: (oData) => {
						const aResults = oData.results || [];
						
						// Actualizar modelo principal
						const oUsersModel = ModelHelper.getModel(this.getOwnerComponent(), "usersModel");
						oUsersModel.setProperty("/", aResults);

						// Preparar modelos de la vista
						this._prepararModelosUsuario(oUsersModel);

						// Seleccionar el CUIT recién creado
						if (sCuitToSelect) {
							const oCbx = this.byId("cuitComboBox");
							if (oCbx) {
								oCbx.setSelectedKey(sCuitToSelect);
								// Disparar cambio para actualizar tiles
								this.onCuitChange();
							}
						}

						resolve(aResults);
					},
					error: (err) => {
						MessageBox.warning("No se pudieron actualizar los CUITs asociados.");
						reject(err);
					}
				});
			});
		}

	});
});