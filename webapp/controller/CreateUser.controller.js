sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sacde/RegistracionUsuariosProv/utils/IASHelper"
], function (BaseController, JSONModel, MessageToast, MessageBox, IASHelper) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.CreateUser", {

		onInit: function () {
			this.getRouter().getRoute("CreateUser").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function () {
			const oComponent = this.getOwnerComponent();
			const oExistingUserModel = oComponent.getModel("editUser");
			const oView = this.getView();
			
			oView.byId("inputEmailConfirm").setValue("");
			oView.byId("inputPasswordConfirm").setValue("");
			
			if (oExistingUserModel) {
				const oData = oExistingUserModel.getData();
				const oEditModel = new JSONModel(oData);
				this.getView().setModel(oEditModel, "newUser");
			} else {
				const oNewUserModel = new JSONModel({
					Correo: "",
					Cuit: "",
					Contrasena: "",
					admin: ""
				});
				this.getView().setModel(oNewUserModel, "newUser");
			}
		},

		onSaveUser: async function () {
			const oView = this.getView();
			const oNewUserModel = this.getView().getModel("newUser").getData();
			
			const sName = oNewUserModel.name ? oNewUserModel.name.trim() : "";
			const sEmail = oNewUserModel.email ? oNewUserModel.email.trim() : "";
			const sEmailC = oView.byId("inputEmailConfirm").getValue().trim();
			const sPass = oNewUserModel.password ? oNewUserModel.password.trim() : "";
			const sPassC = oView.byId("inputPasswordConfirm").getValue();

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

			// Obtener país del usuario admin logueado
			const oUsersModel = this.getOwnerComponent().getModel("usersModel");
			const aUsers = oUsersModel.getData();
			const oAdminUser = Array.isArray(aUsers) ? aUsers.find(user => user.adminUser === "X") : null;
			const sPais = (oAdminUser && oAdminUser.pais) || "AR";

			// Payload para DB: contrasena vacía (login solo vía IAS, clave solo en IAS)
			const oUserPayload = {
				usuario: sName,
				email: sEmail,
				contrasena: "",
				cuit: sCuitSeleccionado,
				admin: "",
				pais: sPais
			};

			const sEntitySet = "/ApplicationLoginSet";
			const oModel = this.getView().getModel("oData");

			this.showBusy();

			oModel.create(sEntitySet, oUserPayload, {
				success: async () => {
					// Crear usuario en IAS con contraseña (no es admin)
					try {
						await IASHelper.createUser({
							email: sEmail,
							nombre: sName,
							pais: sPais,
							password: sPass,
							cuit: sCuitSeleccionado
						}, false);
					} catch (e) {
						// IASHelper ya muestra el error
					}
					
					this.hideBusy();
					MessageToast.show("Usuario creado exitosamente.");
					this.navTo("Main");
				},
				error: (oError) => {
					this.hideBusy();
					const sMsg = this.parseError(oError, "Error al crear el usuario.");
					MessageBox.error(sMsg);
				}
			});
		}

	});
});
