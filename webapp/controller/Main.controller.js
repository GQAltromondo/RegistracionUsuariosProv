sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper",
	"sacde/RegistracionUsuariosProv/utils/IASHelper"
], function (BaseController, MessageToast, MessageBox, ModelHelper, IASHelper) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.Main", {

		onInit: function () {
			// Guarda una referencia al handler enlazado para poder hacer detach luego
			this._fnRouteMatched = this._onRouteMatched.bind(this);

			// Evita doble attach si el controlador se re-instancia
			if (!this._routeAttached) {
				this.getRouter().getRoute("Main").attachPatternMatched(this._fnRouteMatched);
				this._routeAttached = true;
			}
		},

		onExit: function () {
			if (this._fnRouteMatched) {
				this.getRouter().getRoute("Main").detachPatternMatched(this._fnRouteMatched);
				this._routeAttached = false;
			}
		},

		_onRouteMatched: function () {
			this.refresh();
		},

		refresh: async function () {
			const oView = this.getView();
			const oUserModel = ModelHelper.getModel(oView, "usersModel");
			const aUserData = oUserModel.getData();

			try {
				this.showBusy();
				
				// 1) Traer SIEMPRE datos frescos
				const aUsersFresh = await this.getCuitAsociados();

				this.hideBusy();

				// 2) Validación de sesión/datos
				if (!Array.isArray(aUsersFresh) || aUsersFresh.length === 0) {
					this.navTo("Login");
					return;
				}

				// 3) Publicar el set completo
				oView.setModel(new sap.ui.model.json.JSONModel(aUsersFresh), "usuarioActual");

				// 4) AdminCuits (únicos por CUIT)
				const adminByCuit = aUsersFresh
					.filter(u => u.adminUser === "X")
					.reduce((acc, u) => {
						if (!acc[u.cuit]) acc[u.cuit] = { cuit: u.cuit, razonSocial: u.razonSocial };
						return acc;
					}, {});
				const aAdminCuits = Object.values(adminByCuit);

				// Si no hay ningún admin, navegar a Login
				if (aAdminCuits.length === 0) {
					this.navTo("Login");
					return;
				}

				oView.setModel(new sap.ui.model.json.JSONModel(aAdminCuits), "AdminCuitsModel");

				// 5) Set de CUITs con admin para lookup O(1)
				const adminCuitSet = new Set(aAdminCuits.map(a => a.cuit));

				// 6) Usuarios por CUIT admin (excluyendo admins)
				const mUsuariosPorCuit = {};
				aAdminCuits.forEach(a => { mUsuariosPorCuit[a.cuit] = []; });

				aUsersFresh.forEach(user => {
					if (user.adminUser !== "X" && adminCuitSet.has(user.cuit)) {
						if (!mUsuariosPorCuit[user.cuit]) mUsuariosPorCuit[user.cuit] = [];
						mUsuariosPorCuit[user.cuit].push(user);
					}
				});

				const oUsuariosPorCuitModel = new sap.ui.model.json.JSONModel(mUsuariosPorCuit);
				oView.setModel(oUsuariosPorCuitModel, "UsuariosPorCuitModel");

				// 7) Selección de CUIT por defecto
				const oCbx = oView.byId("cuitComboBox");
				const cuitDefault = (aAdminCuits[0] && aAdminCuits[0].cuit) || 
									(aUsersFresh[0] && aUsersFresh[0].cuit) || "";

				if (oCbx && !oCbx.getSelectedKey() && cuitDefault) {
					oCbx.setSelectedKey(cuitDefault);
				}

				// 8) Publicar UsuariosModel según CUIT seleccionado
				const cuitSel = (oCbx && oCbx.getSelectedKey()) || cuitDefault;
				const aUsuarios = (cuitSel && oUsuariosPorCuitModel.getProperty("/" + cuitSel)) || [];
				ModelHelper.getModel(oView, "UsuariosModel").setData(aUsuarios);

				// 9) Actualizar /cuitsAsociados en usersModel
				const aCuitsAsociados = aAdminCuits.map(c => ({ key: c.cuit, text: c.razonSocial }));
				oUserModel.setProperty("/cuitsAsociados", aCuitsAsociados);

			} catch (e) {
				this.hideBusy();
				// Fallback: si no hay nada en usersModel, redirigir a Login
				if (!aUserData || (Array.isArray(aUserData) && aUserData.length === 0)) {
					this.navTo("Login");
				}
			}
		},

		onAccept: function () {
			var oView = this.getView();
			var sNIT = oView.byId("inputNIT").getValue().trim();
			var sRazon = oView.byId("inputRazon").getValue().trim();

			if (!sNIT || !sRazon) {
				MessageToast.show("Completa NIT y Razón social antes de aceptar.");
				return;
			}
			MessageToast.show("Proveedor validado. Ahora agrega usuarios.");
		},

		onAddUser: function () {
			const sCuit = this.getView().byId("cuitComboBox").getSelectedKey();
			if (!sCuit) {
				MessageToast.show("Selecciona un CUIT antes de agregar un usuario.");
				return;
			}

			sessionStorage.setItem("nuevoUsuarioCuit", sCuit);
			this.navTo("CreateUser");
		},

		// Navegar a la pantalla de selección de CUIT / tiles
		onGoToTiles: function () {
			this.navTo("TilesView");
		},

		// Navegar a la pantalla de registro
		onGoToRegister: function () {
			this.navTo("Register");
		},

		onCuitChange: function (oEvent) {
			const sCuit = oEvent.getParameter("selectedItem").getKey();
			const oUsuariosPorCuitModel = this.getView().getModel("UsuariosPorCuitModel");
			const aUsuarios = oUsuariosPorCuitModel.getProperty("/" + sCuit) || [];
			ModelHelper.getModel(this.getView(), "UsuariosModel").setData(aUsuarios);
		},

		onDelete: async function (oEvent) {
			const oModel = this.getView().getModel("oData");

			// Contexto de la fila
			const oCtx = oEvent.getSource().getBindingContext("UsuariosModel");
			const sEmail = oCtx.getProperty("email");
			const sCuit = oCtx.getProperty("cuit");

			const sPath = `/ApplicationLoginSet(email='${sEmail}',cuit='${sCuit}',contrasena='')`;

			// Confirmación
			const confirmed = await new Promise((resolve) => {
				MessageBox.confirm(
					`¿Estás seguro de que querés eliminar el usuario con email: ${sEmail}?`,
					{
						title: "Confirmar eliminación",
						actions: [MessageBox.Action.YES, MessageBox.Action.NO],
						emphasizedAction: MessageBox.Action.NO,
						onClose: (sAction) => resolve(sAction === MessageBox.Action.YES)
					}
				);
			});
			if (!confirmed) return;

			// Helper para usar await con oModel.remove
			const removePromise = () => new Promise((resolve, reject) => {
				oModel.remove(sPath, { success: resolve, error: reject });
			});

			this.showBusy();

			try {
				// 1) Eliminar en backend
				await removePromise();

				// 2) Eliminar en IAS usando helper centralizado
				try {
					await IASHelper.deleteUser(sEmail);
				} catch (e) {
					jQuery.sap.log.warning("No se pudo eliminar en IAS: " + e);
					MessageToast.show("Eliminado en SAP. No se pudo eliminar en IAS.");
				}

				// 3) Refrescar todo con datos nuevos
				await this.refresh();

				MessageToast.show("Registro eliminado correctamente.");
			} catch (err) {
				jQuery.sap.log.error("Error al eliminar:", err);
				MessageBox.error("Error al eliminar el registro.");
			} finally {
				this.hideBusy();
			}
		},

		getCuitAsociados: function () {
			return new Promise((resolve, reject) => {
				const loginData = this.getOwnerComponent().getModel("loginModel").getData();
				const oModel = this.getView().getModel("oData");

				const aFilters = [
					new sap.ui.model.Filter("email", sap.ui.model.FilterOperator.EQ, loginData.email),
					new sap.ui.model.Filter("contrasena", sap.ui.model.FilterOperator.EQ, loginData.password)
				];

				oModel.read("/CuitsAsociadosSet", {
					filters: aFilters,
					success: (oData) => {
						const usersModel = ModelHelper.getModel(this.getOwnerComponent(), "usersModel");
						usersModel.setProperty("/", oData.results);
						resolve(oData.results);
					},
					error: (err) => {
						MessageBox.warning("No se pudieron obtener los CUITs asociados.");
						reject(err);
					}
				});
			});
		}

	});
});
