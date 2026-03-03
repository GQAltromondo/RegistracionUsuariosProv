sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/UIComponent",
	"sap/ui/core/routing/History",
	"sap/ui/core/BusyIndicator"
], function (Controller, UIComponent, History, BusyIndicator) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.BaseController", {

		/**
		 * Obtiene el router de la aplicación
		 * @returns {sap.ui.core.routing.Router} Router de la aplicación
		 */
		getRouter: function () {
			return UIComponent.getRouterFor(this);
		},

		/**
		 * Obtiene el componente propietario
		 * @returns {sap.ui.core.Component} Componente de la aplicación
		 */
		getOwnerComponent: function () {
			return Controller.prototype.getOwnerComponent.call(this);
		},

		/**
		 * Obtiene un modelo por nombre
		 * @param {string} sName - Nombre del modelo
		 * @returns {sap.ui.model.Model} El modelo solicitado
		 */
		getModel: function (sName) {
			return this.getView().getModel(sName);
		},

		/**
		 * Establece un modelo en la vista
		 * @param {sap.ui.model.Model} oModel - Modelo a establecer
		 * @param {string} sName - Nombre del modelo
		 */
		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		/**
		 * Obtiene el bundle de recursos i18n
		 * @returns {sap.base.i18n.ResourceBundle} Resource bundle
		 */
		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		/**
		 * Navegación hacia atrás con fallback
		 */
		onNavBack: function () {
			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				this.getRouter().navTo("TilesView", {}, true);
			}
		},

		/**
		 * Navega a una ruta específica
		 * @param {string} sRoute - Nombre de la ruta
		 * @param {object} oParams - Parámetros de la ruta
		 * @param {boolean} bReplace - Si reemplaza el historial
		 */
		navTo: function (sRoute, oParams, bReplace) {
			this.getRouter().navTo(sRoute, oParams, bReplace);
		},

		/**
		 * Muestra el indicador de carga
		 * @param {number} iDelay - Delay en ms antes de mostrar (default 0)
		 */
		showBusy: function (iDelay) {
			BusyIndicator.show(iDelay || 0);
		},

		/**
		 * Oculta el indicador de carga
		 */
		hideBusy: function () {
			BusyIndicator.hide();
		},

		/**
		 * Parsea errores de respuesta OData
		 * @param {object} oError - Objeto de error
		 * @param {string} sDefaultMsg - Mensaje por defecto
		 * @returns {string} Mensaje de error
		 */
		parseError: function (oError, sDefaultMsg) {
			var sMsg = sDefaultMsg || "Error en la operación.";

			try {
				if (oError.responseText) {
					var oResponse = JSON.parse(oError.responseText);
					var sBackendMsg = oResponse.error && oResponse.error.message && oResponse.error.message.value;
					if (sBackendMsg) {
						sMsg = sBackendMsg;
					}
				}
			} catch (e) {
				// Si no se puede parsear, usar mensaje por defecto
			}

			return sMsg;
		},

		/**
		 * Hash de contraseña usando SHA-256
		 * @param {string} password - Contraseña a hashear
		 * @returns {Promise<string>} Hash en hexadecimal
		 */
		hashPassword: async function (password) {
			var encoder = new TextEncoder();
			var data = encoder.encode(password);
			var hashBuffer = await crypto.subtle.digest('SHA-256', data);
			var hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(function (b) {
				return b.toString(16).padStart(2, '0');
			}).join('');
		}

	});
});
