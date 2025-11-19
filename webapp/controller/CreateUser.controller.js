sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper"
], function (Controller, UIComponent, History, JSONModel, MessageToast, ModelHelper) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.CreateUser", {

		onInit: function () {
			const oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("CreateUser").attachPatternMatched(this._onRouteMatched, this);
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
			const oComponent = this.getOwnerComponent();
			const oExistingUserModel = oComponent.getModel("editUser");
 const oView = this.getView()
  oView.byId("inputEmailConfirm").setValue("")
  oView.byId("inputPasswordConfirm").setValue("")
			if (oExistingUserModel) {
				const oData = oExistingUserModel.getData();
				const oEditModel = new sap.ui.model.json.JSONModel(oData);
				this.getView().setModel(oEditModel, "newUser");
			} else {
				const oNewUserModel = new sap.ui.model.json.JSONModel({
					Correo: "",
					Cuit: "",
					Contrasena: "",
					admin: ""
				});
				this.getView().setModel(oNewUserModel, "newUser");
			}
		},
		onSaveUser: function () {
			var oView = this.getView();
			var oModel = this.getOwnerComponent().getModel("oData");
			var oNewUserModel = this.getView().getModel("newUser").getData()
			const that = this
			var sName = oNewUserModel.name.trim();
			var sEmail = oNewUserModel.email.trim();
			var sEmailC = oView.byId("inputEmailConfirm").getValue().trim();
			var sPass = oNewUserModel.password.trim();
			var sPassC = oView.byId("inputPasswordConfirm").getValue();

			if (!sName || !sEmail || sEmail !== sEmailC || !sPass || sPass !== sPassC) {
				MessageToast.show("Por favor completa todos los campos y valida email/contraseña.");
				return;
			}

			// Obtener CUIT guardado en sessionStorage
			const sCuitSeleccionado = sessionStorage.getItem("nuevoUsuarioCuit");
			if (!sCuitSeleccionado) {
				MessageToast.show("Error: no se pudo recuperar el CUIT seleccionado.");
				return;
			}

			const aUsers = {
				usuario: sName,
				email: sEmail,
				contrasena: sPass,
				cuit: sCuitSeleccionado,
				admin: "",
				pais: "AR"
			}

			var sEntitySet = "/ApplicationLoginSet";
			var oModel = this.getView().getModel("oData");
			oModel.create(sEntitySet, aUsers, {

				success: (oData, response) => {
					console.log(oData)
					this.createIASUser(sCuitSeleccionado);
					this.getOwnerComponent().getRouter().navTo("Main");
					sap.m.MessageToast.show("Registro creado exitosamente.");

				},
				error: (oError) => {
					let sMsg = "Error al crear el registro.";

					try {
						// Algunos servicios devuelven el JSON dentro de responseText
						const oResponse = oError.responseText ? JSON.parse(oError.responseText) : {};
						const sBackendMsg = oResponse.error.message.value;

						if (sBackendMsg) {
							sMsg = sBackendMsg; // "El usuario ya existe."
						}
					} catch (e) {
						// Si no se puede parsear, dejamos el mensaje por defecto
					}

					sap.m.MessageBox.error(sMsg);
				}
			});
	
		},
		onDelete: function (sUsername = "prueba@gmail.com") {
			var oModel = this.getView().getModel("oData");
			var sPath = `/ApplicationLoginSet('${sUsername}')`;

			oModel.remove(sPath, {
				success: () => {
					sap.m.MessageToast.show("Registro eliminado exitosamente.");
					this.getCuitAsociados()
				},
				error: (oError) => {
					error: (oError) => {
					let sMsg = "Error al crear el registro.";

					try {
						// Algunos servicios devuelven el JSON dentro de responseText
						const oResponse = oError.responseText ? JSON.parse(oError.responseText) : {};
						const sBackendMsg = oResponse.error.message.value;

						if (sBackendMsg) {
							sMsg = sBackendMsg; // "El usuario ya existe."
						}
					} catch (e) {
						// Si no se puede parsear, dejamos el mensaje por defecto
					}

					sap.m.MessageBox.error(sMsg);
				}
				}
			});
		},
		getIASToken: function () {
			const url = "/sap/opu/odata/sap/Z_PORTAL_PROVEEDORES_SRV/";

			return new Promise((resolve, reject) => {
				jQuery.ajax({
					url: url,
					method: "GET",
					headers: {
						"X-CSRF-Token": "Fetch"
					},
					success: function (data, textStatus, jqXHR) {
						const sToken = jqXHR.getResponseHeader("X-CSRF-Token");
						if (sToken) {
							console.log("CSRF Token obtenido:", sToken);
							resolve(sToken);
						} else {
							console.warn("No se encontró el token CSRF en los headers.");
							reject("No se encontró el token CSRF.");
						}
					},
					error: function (err) {
						console.error("Error al obtener token CSRF:", err);
						reject("No se pudo obtener el token de autenticación.");
					}
				});
			});
		},
		createIASUser: async function (sCuit) {
			const userModel = this.getView().getModel("newUser");
			const userData = userModel.getData();

			// --- Nombre y país ---
			const fullName = (userData.name || "").trim();
			const parts = fullName.split(/\s+/);
			const givenName = parts.shift() || "";
			const familyName = parts.join(" ") || "";
			const country = (userData.pais || "").toUpperCase();

			// --- Token IAS ---
			let sToken;
			try {
				sToken = await this.getIASToken();
			} catch (e) {
				sap.m.MessageBox.error("No se pudo obtener el token de IAS: " + e);
				return;
			}

			// --- Endpoint SCIM (destino a IAS) ---
			const SCIM_BASE = "/destinations/USER_API/Users";

			// --- Body de creación (SIN password; solo el POST que funcionó) ---
			const createBody = {
				schemas: ["urn:ietf:params:scim:schemas:core:2.0:User",
					"urn:sap:cloud:scim:schemas:extension:custom:2.0:User"
				],
				userName: (userData.email || "").trim(),
				name: {
					givenName,
					familyName
				},
				emails: [{
					value: (userData.email || "").trim(),
					type: "work",
					primary: true
				}],
				addresses: country ? [{
					type: "work",
					country
				}] : [],
				groups: [{
					value: "OSP_Proveedor",
					$ref: "https://webidetesting8346823-goio5drrj1.dispatcher.br1.hana.ondemand.com/destinations/USER_API/Groups/5d28844a90b0db20fb6608a4",
					display: "OSP Proveedor"
				}],
			//	active: true,
				// Pediste llevar esto en el POST
			//	passwordStatus: "enabled",
			 //"urn:sap:cloud:scim:schemas:extension:custom:2.0:User": {
    //     attributes: [
    //         {
    //             name: "customAttribute2",
    //             value: sCuit||""            }
    //     ]
    // }
			};

			const headersJsonAuth = {
				"Content-Type": "application/scim+json",
				"Authorization": `Bearer ${sToken}`
			};

			try {
				// --- SOLO POST (sin intentos de fallback/PUT) ---
				const createRes = await fetch(SCIM_BASE, {
					method: "POST",
					headers: headersJsonAuth,
					body: JSON.stringify(createBody)
				});

				if (!createRes.ok) {
					const txt = await createRes.text();
					if (createRes.status === 409) {
					//	sap.m.MessageBox.error("Ya existe un usuario con estos datos.");
						return;
					}
					throw new Error(`Error creando usuario (${createRes.status}): ${txt}`);
				}

				const createdUser = await createRes.json();

				sap.m.MessageToast.show("Usuario creado en IAS.");
				// Limpiar sólo campos locales (no seteamos clave aquí)
				if (this.byId("inpPassword")) this.byId("inpPassword").setValue("");
				if ("passwordTemporal" in userData) {
					userData.passwordTemporal = "";
					userModel.refresh(true);
				}

				// Si querés usar el id más adelante:
				return createdUser.id;

			} catch (err) {
				jQuery.sap.log.error("Error IAS", err);
				sap.m.MessageBox.error("No se pudo crear el usuario en IAS: " + (err.message || err));
			}
		},
		updateIASUserPassword: async function (userId, newPassword) {
			if (!userId || !newPassword) {
				sap.m.MessageBox.error("Faltan datos: userId o nueva contraseña.");
				return;
			}

			// --- Token IAS ---
			let sToken;
			try {
				sToken = await this.getIASToken();
			} catch (e) {
				sap.m.MessageBox.error("No se pudo obtener el token de IAS: " + e);
				return;
			}

			const SCIM_BASE = "/destinations/USER_API/Users";

			const headersJsonAuth = {
				"Content-Type": "application/scim+json",
				"Authorization": `Bearer ${sToken}`
			};

			try {
				// 1) Leer el recurso actual (para If-Match / version)
				const getRes = await fetch(`${SCIM_BASE}/${encodeURIComponent(userId)}`, {
					headers: {
						"Authorization": `Bearer ${sToken}`
					}
				});
				if (!getRes.ok) throw new Error(await getRes.text());
				const current = await getRes.json();

				var putBody = jQuery.extend({}, current, {
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
					id: current.id,
					password: newPassword
				});
				delete putBody.meta;

				var headers = jQuery.extend({}, headersJsonAuth);
				if (current.meta.version) {
					headers["If-Match"] = current.meta.version;
				}

				const putRes = await fetch(`${SCIM_BASE}/${encodeURIComponent(userId)}`, {
					method: "PUT",
					headers,
					body: JSON.stringify(putBody)
				});

				if (!putRes.ok) {
					const txt = await putRes.text();
					throw new Error(`No se pudo actualizar la contraseña (${putRes.status}): ${txt}`);
				}

				sap.m.MessageToast.show("Contraseña actualizada en IAS.");
				return true;

			} catch (err) {
				jQuery.sap.log.error("Error actualizando password en IAS", err);
				sap.m.MessageBox.error("No se pudo actualizar la contraseña en IAS: " + (err.message || err));
			}
		},

	});
});