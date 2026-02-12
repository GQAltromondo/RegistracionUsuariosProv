sap.ui.define([
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (MessageToast, MessageBox) {
	"use strict";

	var SCIM_BASE = "/destinations/USER_API/Users";
	var CSRF_URL = "/sap/opu/odata/sap/Z_PORTAL_PROVEEDORES_SRV/";

	return {

		/**
		 * Obtiene el token CSRF para autenticación con IAS
		 * @returns {Promise<string>} Token CSRF
		 */
		getToken: function () {
			return new Promise(function (resolve, reject) {
				jQuery.ajax({
					url: CSRF_URL,
					method: "GET",
					headers: {
						"X-CSRF-Token": "Fetch"
					},
					success: function (data, textStatus, jqXHR) {
						var sToken = jqXHR.getResponseHeader("X-CSRF-Token");
						if (sToken) {
							resolve(sToken);
						} else {
							reject("No se encontró el token CSRF.");
						}
					},
					error: function (err) {
						jQuery.sap.log.error("Error al obtener token CSRF:", err);
						reject("No se pudo obtener el token de autenticación.");
					}
				});
			});
		},

		/**
		 * Crea un usuario en IAS
		 * @param {object} oUserData - Datos del usuario
		 * @param {string} oUserData.email - Email del usuario
		 * @param {string} oUserData.nombre - Nombre completo
		 * @param {string} oUserData.pais - Código de país
		 * @param {boolean} bIsAdmin - Si es administrador
		 * @returns {Promise<object>} Usuario creado
		 */
		createUser: async function (oUserData, bIsAdmin) {
			var sToken;
			try {
				sToken = await this.getToken();
			} catch (e) {
				MessageBox.error("No se pudo obtener el token de IAS: " + e);
				throw e;
			}

			var fullName = (oUserData.nombre || "").trim();
			var parts = fullName.split(/\s+/);
			var givenName = parts.shift() || "";
			var familyName = parts.join(" ") || "";
			var country = (oUserData.pais || "").toUpperCase();

			var aGroups = [{
				value: "OSP_Proveedor",
				$ref: "https://webidetesting8346823-goio5drrj1.dispatcher.br1.hana.ondemand.com/destinations/USER_API/Groups/5d28844a90b0db20fb6608a4",
				display: "OSP Proveedor"
			}];

			// Si es admin, agregar grupo adicional
			if (bIsAdmin) {
				aGroups.push({
					value: "OSP_Proveedor_Admin",
					$ref: "https://webidetesting8345862-goio5drrj1.dispatcher.br1.hana.ondemand.com/destinations/USER_API/Groups/689343c5a0d22e7230594751",
					display: "OSP Proveedor Admin"
				});
			}

			var oCreateBody = {
				schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
				userName: (oUserData.email || "").trim(),
				name: {
					givenName: givenName,
					familyName: familyName
				},
				emails: [{
					value: (oUserData.email || "").trim(),
					type: "work",
					primary: true
				}],
				addresses: country ? [{
					type: "work",
					country: country
				}] : [],
				groups: aGroups
			};

			var oHeaders = {
				"Content-Type": "application/scim+json",
				"Authorization": "Bearer " + sToken
			};

			try {
				var oResponse = await fetch(SCIM_BASE, {
					method: "POST",
					headers: oHeaders,
					body: JSON.stringify(oCreateBody)
				});

				if (!oResponse.ok) {
					var sText = await oResponse.text();
					if (oResponse.status === 409) {
						// Usuario ya existe, no es error crítico
						jQuery.sap.log.warning("Usuario ya existe en IAS");
						return null;
					}
					throw new Error("Error creando usuario (" + oResponse.status + "): " + sText);
				}

				var oCreatedUser = await oResponse.json();
				MessageToast.show("Usuario creado en IAS.");
				return oCreatedUser;

			} catch (err) {
				jQuery.sap.log.error("Error IAS", err);
				MessageBox.error("No se pudo crear el usuario en IAS: " + (err.message || err));
				throw err;
			}
		},

		/**
		 * Elimina un usuario de IAS por email
		 * @param {string} sEmail - Email del usuario a eliminar
		 * @returns {Promise<boolean>} True si se eliminó correctamente
		 */
		deleteUser: async function (sEmail) {
			try {
				var sToken = await this.getToken();

				// 1. Buscar usuario por email
				var sGetUrl = SCIM_BASE + '?filter=emails eq "' + sEmail + '"';

				var oSearchResult = await new Promise(function (resolve, reject) {
					jQuery.ajax({
						url: sGetUrl,
						method: "GET",
						headers: {
							"Authorization": "Bearer " + sToken
						},
						success: resolve,
						error: reject
					});
				});

				if (!oSearchResult.Resources || oSearchResult.Resources.length === 0) {
					MessageBox.warning("No se encontró el usuario en IAS.");
					return false;
				}

				var sUserId = oSearchResult.Resources[0].id;

				// 2. Eliminar el usuario
				var sDeleteUrl = SCIM_BASE + "/" + sUserId;

				await new Promise(function (resolve, reject) {
					jQuery.ajax({
						url: sDeleteUrl,
						method: "DELETE",
						headers: {
							"Authorization": "Bearer " + sToken
						},
						success: resolve,
						error: reject
					});
				});

				MessageToast.show("Usuario eliminado de IAS correctamente.");
				return true;

			} catch (err) {
				jQuery.sap.log.error("Error al eliminar usuario en IAS:", err);
				MessageBox.error("No se pudo eliminar el usuario en IAS.");
				return false;
			}
		},

		/**
		 * Actualiza la contraseña de un usuario en IAS
		 * @param {string} sUserId - ID del usuario en IAS
		 * @param {string} sNewPassword - Nueva contraseña
		 * @returns {Promise<boolean>} True si se actualizó correctamente
		 */
		updatePassword: async function (sUserId, sNewPassword) {
			if (!sUserId || !sNewPassword) {
				MessageBox.error("Faltan datos: userId o nueva contraseña.");
				return false;
			}

			var sToken;
			try {
				sToken = await this.getToken();
			} catch (e) {
				MessageBox.error("No se pudo obtener el token de IAS: " + e);
				return false;
			}

			var oHeaders = {
				"Content-Type": "application/scim+json",
				"Authorization": "Bearer " + sToken
			};

			try {
				// 1. Leer el recurso actual
				var oGetRes = await fetch(SCIM_BASE + "/" + encodeURIComponent(sUserId), {
					headers: {
						"Authorization": "Bearer " + sToken
					}
				});

				if (!oGetRes.ok) {
					throw new Error(await oGetRes.text());
				}

				var oCurrent = await oGetRes.json();

				var oPutBody = jQuery.extend({}, oCurrent, {
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
					id: oCurrent.id,
					password: sNewPassword
				});
				delete oPutBody.meta;

				var oPutHeaders = jQuery.extend({}, oHeaders);
				if (oCurrent.meta && oCurrent.meta.version) {
					oPutHeaders["If-Match"] = oCurrent.meta.version;
				}

				var oPutRes = await fetch(SCIM_BASE + "/" + encodeURIComponent(sUserId), {
					method: "PUT",
					headers: oPutHeaders,
					body: JSON.stringify(oPutBody)
				});

				if (!oPutRes.ok) {
					var sText = await oPutRes.text();
					throw new Error("No se pudo actualizar la contraseña (" + oPutRes.status + "): " + sText);
				}

				MessageToast.show("Contraseña actualizada en IAS.");
				return true;

			} catch (err) {
				jQuery.sap.log.error("Error actualizando password en IAS", err);
				MessageBox.error("No se pudo actualizar la contraseña en IAS: " + (err.message || err));
				return false;
			}
		}

	};
});
