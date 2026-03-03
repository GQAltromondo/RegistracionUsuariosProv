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
			_onRouteMatched: async function () {
				this.byId("cuitComboBox").setSelectedKey("");

				// Intentar por defecto cargar el usuario desde IAS y obtener CUITs
				try {
					const res = await this.loadUsersFromUserAPI();
					// getCuitAsociados actualiza usersModel y CuitsModel
					await this.getCuitAsociados(res.email);
					const oUserModelUpdated = this.getOwnerComponent().getModel("usersModel");
					const oDataUpdated = oUserModelUpdated.getData();
					if (!oDataUpdated || (Array.isArray(oDataUpdated) && oDataUpdated.length === 0)) {
						this.navTo("Login");
						return;
					}
					this.getView().setModel(oUserModelUpdated);
					this.onCuitChange();
					this._prepararModelosUsuario(oUserModelUpdated);
					return;
				} catch (e) {
					// Si falla, intentar usar usersModel existente y si no hay datos redirigir a Login
					const oUserModel = this.getOwnerComponent().getModel("usersModel");
					const oData = oUserModel.getData();
					if (!oData ||
						(Array.isArray(oData) && oData.length === 0) ||
						(typeof oData === "object" && !Array.isArray(oData) && Object.keys(oData).length === 0)) {
						this.navTo("Login");
						return;
					}
					this.getView().setModel(oUserModel);
					this.onCuitChange();
					this._prepararModelosUsuario(oUserModel);
				}

		},
			async loadUsersFromUserAPI() {
			try {

				const userInfo = await $.ajax({
					url: "/services/userapi/currentUser",
					method: "GET",
					headers: {
						"Accept": "application/json"
					}
				});

				var bIsDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
				var sEmailTemp = bIsDev ? "guillermo.quattrocchi@altromondo.com.ar" : userInfo.email;
				var sEmail = (sEmailTemp === "mgutierrez@inclusion.cloud") ? "sdbracamonte@gmail.com" : sEmailTemp;

				// Asegurar que el modelo de login tenga email (evita filtros con null)
				try {
					const oLoginModel = this.getOwnerComponent().getModel("loginModel");
					if (oLoginModel) {
						oLoginModel.setProperty("/email", sEmail);
						// dejar contraseña vacía por defecto (mejor que null para filtros OData)
						oLoginModel.setProperty("/password", "");
					}
				} catch (e) {
					// no crítico
				}

				const cuits = await this.getCuitAsociados(sEmail);

				const sUrl = `/destinations/USER_API/Users?filter=emails eq '${sEmail}'`;
				const userApiResponse = await $.ajax({
					url: sUrl,
					type: "GET",
					contentType: "application/scim+json",
					dataType: "json"
				});

				const aUsers = userApiResponse.Resources || [];
				if (aUsers.length === 0) {
					throw new Error("No se encontró el usuario en USER_API.");
				}

				const oUser = aUsers[0];
				const aGroups = oUser.groups.map(g => g.display);

				return {
					email: sEmail,
					cuits,
					user: oUser,
					groups: aGroups
				};

			} catch (err) {
				console.error("Error en loadUsersFromUserAPI:", err);
				sap.m.MessageBox.error("No se pudo obtener la información del usuario.");
				throw err;
			}
		},
			getCuitAsociados: function (email) {
			return new Promise((resolve, reject) => {
				const oModel = this.getView().getModel("oData");
				const datosGen = this.getView().getModel("datosGenerales");
				const combo = this.byId("inputCUIT");

				const aFilters = [
					new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, email)
				];

				oModel.read("/CuitsAsociadosSet", {
					filters: aFilters,
					success: (oData) => {
						const results = Array.isArray(oData.results) ? oData.results : [];

						// 1) Filtrar admin = "X" y deduplicar por CUIT
						const mapByCuit = new Map();
						for (const r of results) {
							const cuit = String(r.cuit || "").trim();
							if (!cuit || r.adminUser !== "X") continue;
							if (!mapByCuit.has(cuit)) mapByCuit.set(cuit, r);
						}
						const adminRows = Array.from(mapByCuit.values());

						// 2) Adaptar al esquema del ComboBox { id, descripcion }
						const items = adminRows.map(r => ({
							id: String(r.cuit).trim(),
							descripcion: `${String(r.cuit).trim()} - ${(r.razonSocial || "").trim()}`
						})).sort((a, b) => a.id.localeCompare(b.id));

						// 3) Setear modelo del ComboBox
						const cuitsModel = new sap.ui.model.json.JSONModel(items);
						this.getView().setModel(cuitsModel, "CuitsModel");

						// 3b) También actualizar el usersModel del componente con los resultados crudos
						try {
							const oCompUsersModel = this.getOwnerComponent().getModel("usersModel");
							if (oCompUsersModel) {
								oCompUsersModel.setProperty("/", results);
							}
						} catch (e) {
							// no crítico, continuar
						}

						// 4) Mantener selección previa si es válida, o decidir selección/edición
						const prev = String(datosGen.getProperty("/Cuit") || "").trim();
						const hasPrev = !!prev && items.some(it => it.id === prev);

						if (hasPrev) {
							// Mantengo la selección previa
							combo.setEditable(items.length > 1);
						} else if (items.length === 1) {
							// Autoselección cuando hay un único CUIT
							datosGen.setProperty("/Cuit", items[0].id);
							combo.setEditable(false);
						} else if (items.length > 1) {
							// Varias opciones: habilitar para que el usuario elija
							datosGen.setProperty("/Cuit", "");
							combo.setEditable(true);
						} else {
							// Sin resultados admin
							datosGen.setProperty("/Cuit", "");
							combo.setEditable(false);
						}

						resolve(items.map(it => it.id));
					},
					error: (err) => {
						sap.m.MessageBox.warning("No se pudieron obtener los CUITs asociados.");
						reject(err);
					}
				});
			});
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
							pais: oAdminUser.pais || "AR",
							cuit: sCuit
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