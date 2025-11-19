sap.ui.define([
	"sap/ui/core/mvc/Controller", "sap/ui/core/UIComponent",
	"sap/m/MessageToast", "sap/ui/core/routing/History", "sacde/RegistracionUsuariosProv/utils/ModelHelper"
], function (Controller, UIComponent, MessageToast, History, ModelHelper) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.Main", {
		onInit: function () {
			const oRouter = this.getOwnerComponent().getRouter();

			// Guarda una referencia al handler enlazado para poder hacer detach luego
			this._fnRouteMatched = this._onRouteMatched.bind(this);

			// Evita doble attach si el controlador se re-instancia
			if (!this._routeAttached) {
				oRouter.getRoute("Main").attachPatternMatched(this._fnRouteMatched);
				this._routeAttached = true;
			}
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
	onExit: function () {
  const oRouter = this.getOwnerComponent().getRouter();
  if (this._fnRouteMatched) {
    oRouter.getRoute("Main").detachPatternMatched(this._fnRouteMatched);
    this._routeAttached = false;
  }
},
_onRouteMatched: function () {
  this.refresh(); // no hace falta bind acá, ya está bind en onInit
},

refresh: async function () {
  const oView = this.getView();
  const oUserModel = ModelHelper.getModel(oView, "usersModel");
  const aUserData = oUserModel.getData();

  try {
    // 1) Traer SIEMPRE datos frescos
    const aUsersFresh = await this.getCuitAsociados();

    // 2) Validación de sesión/datos
    if (!Array.isArray(aUsersFresh) || aUsersFresh.length === 0) {
      this.getOwnerComponent().getRouter().navTo("Login");
      return;
    }

    // 3) Publicar el set completo (si lo necesitás para debug/consulta)
    oView.setModel(new sap.ui.model.json.JSONModel(aUsersFresh), "usuarioActual");

    // 4) AdminCuits (únicos por CUIT)
    const adminByCuit = aUsersFresh
      .filter(u => u.adminUser === "X")
      .reduce((acc, u) => {
        // si hay repetidos por CUIT, conservamos el primero que aparezca
        if (!acc[u.cuit]) acc[u.cuit] = { cuit: u.cuit, razonSocial: u.razonSocial };
        return acc;
      }, {});
    const aAdminCuits = Object.values(adminByCuit);

    // Si no hay ningún admin, no podemos armar UsuariosPorCuit correctamente
    if (aAdminCuits.length === 0) {
      // Podés decidir otra UX acá, por ahora navego a Login
      this.getOwnerComponent().getRouter().navTo("Login");
      return;
    }

    oView.setModel(new sap.ui.model.json.JSONModel(aAdminCuits), "AdminCuitsModel");

    // 5) Set de CUITs con admin para lookup O(1)
    const adminCuitSet = new Set(aAdminCuits.map(a => a.cuit));

    // 6) Usuarios por CUIT admin (excluyendo admins)
    const mUsuariosPorCuit = {};
    // Inicializar todas las claves para evitar 'undefined' en los binds
    aAdminCuits.forEach(a => { mUsuariosPorCuit[a.cuit] = []; });

    aUsersFresh.forEach(user => {
      if (user.adminUser !== "X" && adminCuitSet.has(user.cuit)) {
        if (!mUsuariosPorCuit[user.cuit]) mUsuariosPorCuit[user.cuit] = [];
        mUsuariosPorCuit[user.cuit].push(user);
      }
    });

    const oUsuariosPorCuitModel = new sap.ui.model.json.JSONModel(mUsuariosPorCuit);
    oView.setModel(oUsuariosPorCuitModel, "UsuariosPorCuitModel");

    // 7) Selección de CUIT por defecto (respeta el seleccionado si ya existe)
    const oCbx = oView.byId("cuitComboBox");
    // preferimos un CUIT admin; si no, el primero de la lista fresca
    const cuitDefault =
      (aAdminCuits[0] && aAdminCuits[0].cuit) ||
      (aUsersFresh[0] && aUsersFresh[0].cuit) ||
      "";

    if (oCbx && !oCbx.getSelectedKey() && cuitDefault) {
      oCbx.setSelectedKey(cuitDefault);
    }

    // 8) Publicar UsuariosModel según CUIT seleccionado
    const cuitSel = (oCbx && oCbx.getSelectedKey()) || cuitDefault;
    const aUsuarios = (cuitSel && oUsuariosPorCuitModel.getProperty("/" + cuitSel)) || [];
    ModelHelper.getModel(oView, "UsuariosModel").setData(aUsuarios);

    // 9) Actualizar /cuitsAsociados en usersModel (para combos, etc.)
    const aCuitsAsociados = aAdminCuits.map(c => ({ key: c.cuit, text: c.razonSocial }));
    oUserModel.setProperty("/cuitsAsociados", aCuitsAsociados);

  } catch (e) {
    // Fallback: si no hay nada en usersModel, redirigir a Login
    if (!aUserData || (Array.isArray(aUserData) && aUserData.length === 0)) {
      this.getOwnerComponent().getRouter().navTo("Login");
    }
  }
}
,

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
				sap.m.MessageToast.show("Selecciona un CUIT antes de agregar un usuario.");
				return;
			}

			sessionStorage.setItem("nuevoUsuarioCuit", sCuit);

			this.getOwnerComponent().getRouter().navTo("CreateUser");
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
  const oCtx   = oEvent.getSource().getBindingContext("UsuariosModel");
  const sEmail = oCtx.getProperty("email");
  const sCuit  = oCtx.getProperty("cuit");

  const sPath = `/ApplicationLoginSet(email='${sEmail}',cuit='${sCuit}',contrasena='')`;

  // Confirmación
  const confirmed = await new Promise((resolve) => {
    sap.m.MessageBox.confirm(
      `¿Estás seguro de que querés eliminar el usuario con email: ${sEmail}?`,
      {
        title: "Confirmar eliminación",
        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
        emphasizedAction: sap.m.MessageBox.Action.NO,
        onClose: (sAction) => resolve(sAction === sap.m.MessageBox.Action.YES)
      }
    );
  });
  if (!confirmed) return;

  // Helper para usar await con oModel.remove
  const removePromise = () => new Promise((resolve, reject) => {
    oModel.remove(sPath, { success: resolve, error: reject });
  });


  try {
    // 1) Eliminar en backend
    await removePromise();

    // 2) (Opcional) Eliminar en IAS – no frenamos el flujo si falla
    try {
      await this.deleteIASUser(sEmail);
    } catch (e) {
      jQuery.sap.log.warning("No se pudo eliminar en IAS: " + e);
      sap.m.MessageToast.show("Eliminado en SAP. No se pudo eliminar en IAS.");
    }

    // 3) Refrescar todo con datos nuevos
    await this.refresh();

    sap.m.MessageToast.show("Registro eliminado correctamente.");
  } catch (err) {
    console.error(err);
    sap.m.MessageBox.error("Error al eliminar el registro.");
  } finally {
    sap.m.BusyIndicator.hide();
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
        usersModel.setProperty("/", oData.results);      // <-- actualiza fuente
        resolve(oData.results);                          // <-- devolvemos datos frescos
      },
      error: (err) => {
        sap.m.MessageBox.warning("No se pudieron obtener los CUITs asociados.");
        reject(err);
      }
    });
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

		deleteIASUser: async function (sEmail) {
			try {
				const sToken = await this.getIASToken();

				// 1. Buscar usuario por email
				const sGetUrl = `/destinations/USER_API/Users?filter=emails eq "${sEmail}"`;

				const oSearchResult = await new Promise((resolve, reject) => {
					jQuery.ajax({
						url: sGetUrl,
						method: "GET",
						headers: {
							"Authorization": `Bearer ${sToken}`
						},
						success: resolve,
						error: reject
					});
				});

				if (!oSearchResult.Resources || oSearchResult.Resources.length === 0) {
					sap.m.MessageBox.warning("No se encontró el usuario en IAS.");
					return;
				}

				const sUserId = oSearchResult.Resources[0].id;

				// 2. Eliminar el usuario
				const sDeleteUrl = `/destinations/USER_API/Users/${sUserId}`;

				await new Promise((resolve, reject) => {
					jQuery.ajax({
						url: sDeleteUrl,
						method: "DELETE",
						headers: {
							"Authorization": `Bearer ${sToken}`
						},
						success: resolve,
						error: reject
					});
				});

				sap.m.MessageToast.show("Usuario eliminado de IAS correctamente.");

			} catch (err) {
				console.error("Error al eliminar usuario en IAS:", err);
				sap.m.MessageBox.error("No se pudo eliminar el usuario en IAS.");
			}
		},
		_hashPassword: async function (password) {
			const encoder = new TextEncoder();
			const data = encoder.encode(password);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		},

	});
});