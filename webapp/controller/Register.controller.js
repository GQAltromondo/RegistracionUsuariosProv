sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sacde/RegistracionUsuariosProv/utils/Validations",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper",
	"sap/m/MessageToast",
	"sap/m/MessageBox",
	"sap/ui/core/routing/History",
	"sap/ui/core/UIComponent"
], function (Controller, Validation, ModelHelper, MessageToast, MessageBox, History, UIComponent) {
	"use strict";

	return Controller.extend("sacde.RegistracionUsuariosProv.controller.Register", {
		onInit: function () {
			this._Validation = Validation;
			ModelHelper.getModel(this.getView(),"viewModel").setData({
				formValid: false
			})
			this.getPaises()
			const oRouter = this.getOwnerComponent().getRouter();
			oRouter.getRoute("Register").attachPatternMatched(this._onRouteMatched, this);
		},
		_onRouteMatched: function () {
			const oView = this.getView()
			oView.byId("inputValidarEmail").setValue("")
			oView.byId("inputConfirmarContrasena").setValue("")
			const oUsuarioModel = new sap.ui.model.json.JSONModel({});

			// Asignarlo al view bajo el nombre 'usuario'
			this.getView().setModel(oUsuarioModel, "usuario");
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
		_hashPassword: async function (password) {
			const encoder = new TextEncoder();
			const data = encoder.encode(password);
			const hashBuffer = await crypto.subtle.digest('SHA-256', data);
			const hashArray = Array.from(new Uint8Array(hashBuffer));
			return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		},
		getPaises: function () {
			const oDataModel = this.getOwnerComponent().getModel("oData");
			oDataModel.setUseBatch(false);

			const aFilters = [
				new sap.ui.model.Filter("NombreLista", sap.ui.model.FilterOperator.EQ, "PAISES")
			];

			const oViewModel = ModelHelper.getModel(this.getView(), "countryModel");
			oViewModel.setSizeLimit(1000); // mostrar más de 100

			oDataModel.read("/ListasSet", {
				filters: aFilters,
				success: (data) => {
					const aResults = data.results || [];

					// Solo items de la lista "PAISES"
					const aPaises = aResults.filter(r =>
						String(r.NombreLista || "").trim().toUpperCase() === "PAISES"
					);

					// Opcional: ordenar por el texto visible
					aPaises.sort((a, b) =>
						String(a.Texto || "").localeCompare(String(b.Texto || ""), "es")
					);

					oViewModel.setProperty("/countries", aPaises);
				},
				error: (e) => {
					console.error("Error al cargar países:", e);
					sap.m.MessageToast.show("No se pudieron cargar los países.");
				}
			});
		},

		onLiveEmailChange: function (oEvent) {
			const email = oEvent.getSource().getValue();
			const isValid = this._Validation.validarEmail(email);
			oEvent.getSource().setValueState(isValid ? "None" : "Error");
			oEvent.getSource().setValueStateText("Email inválido");
			this._updateFormState();
		},
		onLiveConfirmEmailChange: function () {
			const email = this.byId("inputEmail").getValue();
			const confirmEmail = this.byId("inputValidarEmail").getValue();
			const input = this.byId("inputValidarEmail");
			const isEqual = email === confirmEmail;

			input.setValueState(isEqual ? "None" : "Error");
			input.setValueStateText("Los correos no coinciden");
			this._updateFormState();
		},

		onLivePasswordChange: function (oEvent) {
			const password = oEvent.getSource().getValue();
			const isValid = this._Validation.validarContrasena(password);
			oEvent.getSource().setValueState(isValid ? "None" : "Error");
			oEvent.getSource().setValueStateText("Debe tener al menos 8 caracteres, una mayúscula y un símbolo");
			this._updateFormState();
		},

		onLiveConfirmPasswordChange: function () {
			const pass = this.byId("inputContrasena").getValue();
			const confirm = this.byId("inputConfirmarContrasena").getValue();
			const input = this.byId("inputConfirmarContrasena");
			const isEqual = pass === confirm;

			input.setValueState(isEqual ? "None" : "Error");
			input.setValueStateText("Las contraseñas no coinciden");
			this._updateFormState();
		},
		onLiveChangeCuit: function (oEvent) {
			const oInput = oEvent.getSource();
			const sValue = oEvent.getParameter("value");

			// Obtener el país desde el modelo "usuario"
			const oUsuarioModel = this.getView().getModel("usuario");
			const sCountryCode = oUsuarioModel.getProperty("/pais");

			// Solo validar si el país es Argentina
			if (sCountryCode === "AR") {
				const oValidation = this._Validation.isValidCuit(sValue);

				if (!oValidation.valid) {
					oInput.setValueState("Error");
					oInput.setValueStateText(oValidation.text);
				} else {
					oInput.setValueState("None");
					oInput.setValueStateText("");
				}
			} else {
				// Limpiar estado si no aplica validación
				oInput.setValueState("None");
				oInput.setValueStateText("");
			}
			this._updateFormState();
		},

		onCreate: async function () {
			const oView = this.getView();
			const oUser = oView.getModel("usuario").getData();
			oUser.admin = "X";

			const aCampos = [{
				key: "usuario",
				id: "inputNombre"
			}, {
				key: "pais",
				id: "countryComboBox"
			}, {
				key: "email",
				id: "inputEmail"
			}, {
				key: "contrasena",
				id: "inputContrasena"
			}, {
				key: "cuit",
				id: "inputCUIT"
			}, {
				key: "razon_soc",
				id: "inputRazonSocial"
			}];

			let bError = false;

			aCampos.forEach(({
				key,
				id
			}) => {
				const sValor = oUser[key];
				const oInput = oView.byId(id);
				if (!sValor || sValor.trim() === "") {
					oInput.setValueState("Error");
					oInput.setValueStateText("Este campo es obligatorio");
					bError = true;
				} else {
					oInput.setValueState("None");
				}
			});

			// Validar campos manuales (confirmar email/contraseña)
			const sEmailConfirm = oView.byId("inputValidarEmail").getValue();
			const sPasswordConfirm = oView.byId("inputConfirmarContrasena").getValue();

			if (!sEmailConfirm || sEmailConfirm.trim() === "") {
				oView.byId("inputValidarEmail").setValueState("Error");
				oView.byId("inputValidarEmail").setValueStateText("Este campo es obligatorio");
				bError = true;
			} else {
				oView.byId("inputValidarEmail").setValueState("None");
			}

			if (!sPasswordConfirm || sPasswordConfirm.trim() === "") {
				oView.byId("inputConfirmarContrasena").setValueState("Error");
				oView.byId("inputConfirmarContrasena").setValueStateText("Este campo es obligatorio");
				bError = true;
			} else {
				oView.byId("inputConfirmarContrasena").setValueState("None");
			}

			// Validación final de coincidencias
			if (oUser.email !== sEmailConfirm) {
				oView.byId("inputValidarEmail").setValueState("Error");
				oView.byId("inputValidarEmail").setValueStateText("Los emails no coinciden");
				sap.m.MessageBox.error("Los emails no coinciden.");
				return;
			}

			if (oUser.contrasena !== sPasswordConfirm) {
				oView.byId("inputConfirmarContrasena").setValueState("Error");
				oView.byId("inputConfirmarContrasena").setValueStateText("Las contraseñas no coinciden");
				sap.m.MessageBox.error("Las contraseñas no coinciden.");
				return;
			}

			// Si hay campos incompletos, detener
			if (bError) {
				sap.m.MessageBox.warning("Por favor, complete todos los campos obligatorios.");
				return;
			}

			//oUser.contrasena = await this._hashPassword(oUser.contrasena);

			const sEntitySet = "/ApplicationLoginSet";
			const oModel = oView.getModel("oData");

			oModel.create(sEntitySet, oUser, {
				success: (oData, response) => {
					console.log(oData);
					this.createIASUser(); // Crear usuario en IAS luego del backend
					sap.m.MessageToast.show("Registro creado exitosamente.");
					// Limpieza opcional
					this.getOwnerComponent().getRouter().navTo("Login");
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

		onRegistrarAdmin: function () {
			const oView = this.getView();
			const Validation = this._Validation; // Asegúrate de tener esto cargado en onInit

			// Obtener campos
			const sNombre = oView.byId("inputNombre").getValue().trim();
			const sEmail = oView.byId("inputEmail").getValue().trim();
			const sEmailConfirm = oView.byId("inputValidarEmail").getValue().trim();
			const sPass = oView.byId("inputContrasena").getValue();
			const sPassConfirm = oView.byId("inputConfirmarContrasena").getValue();
			const sCUIT = oView.byId("inputCUIT").getValue().trim();
			const sRazonSocial = oView.byId("inputRazonSocial").getValue().trim();
			const sCountry = oView.byId("countryComboBox").getSelectedKey();

			let valido = true;

			// Campos requeridos
			const campos = [{
				id: "inputNombre",
				valor: sNombre
			}, {
				id: "inputEmail",
				valor: sEmail
			}, {
				id: "inputValidarEmail",
				valor: sEmailConfirm
			}, {
				id: "inputContrasena",
				valor: sPass
			}, {
				id: "inputConfirmarContrasena",
				valor: sPassConfirm
			}, {
				id: "inputCUIT",
				valor: sCUIT
			}, {
				id: "inputRazonSocial",
				valor: sRazonSocial
			}, {
				id: "countryComboBox",
				valor: sCountry
			}];

			campos.forEach(campo => {
				const input = oView.byId(campo.id);
				if (!campo.valor) {
					input.setValueState("Error");
					input.setValueStateText("Campo obligatorio");
					valido = false;
				} else {
					input.setValueState("None");
				}
			});

			// Validar email con regex
			if (!Validation.validarEmail(sEmail)) {
				oView.byId("inputEmail").setValueState("Error");
				oView.byId("inputEmail").setValueStateText("Email inválido");
				valido = false;
			}

			// Confirmar email
			if (sEmail !== sEmailConfirm) {
				oView.byId("inputValidarEmail").setValueState("Error");
				oView.byId("inputValidarEmail").setValueStateText("Los correos no coinciden");
				valido = false;
			}

			// Validar contraseña con regex
			if (!Validation.validarContrasena(sPass)) {
				oView.byId("inputContrasena").setValueState("Error");
				oView.byId("inputContrasena").setValueStateText("Debe tener al menos 8 caracteres, una mayúscula y un símbolo");
				valido = false;
			}

			// Confirmar contraseña
			if (sPass !== sPassConfirm) {
				oView.byId("inputConfirmarContrasena").setValueState("Error");
				oView.byId("inputConfirmarContrasena").setValueStateText("Las contraseñas no coinciden");
				valido = false;
			}

			if (!valido) {
				MessageBox.error("Por favor, corrija los errores antes de continuar.");
				return;
			}

			// Validación de CUIT en modelo
			const oModelUsers = this.getOwnerComponent().getModel("users");
			const aUsers = oModelUsers.getData();

			const bCuitExists = aUsers.some(user =>
				user.role === "admin" &&
				user.cuitsAsociados &&
				user.cuitsAsociados.some(cuitObj => cuitObj.cuit === sCUIT)
			);

			if (bCuitExists) {
				MessageBox.error("El CUIT ya tiene un administrador registrado.");
				return;
			}

			aUsers.push({
				name: sNombre,
				email: sEmail,
				password: sPass,
				cuit: sCUIT,
				razonSocial: sRazonSocial,
				role: "admin"
			});
			oModelUsers.refresh();

			MessageToast.show("Administrador registrado correctamente.");
			this.getOwnerComponent().getRouter().navTo("Main");
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
		createIASUser: async function () {
			const userModel = this.getView().getModel("usuario");
			const userData = userModel.getData();

			// --- Nombre y país ---
			const fullName = (userData.usuario || "").trim();
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
				schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
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
				"groups": [{
					"value": "OSP_Proveedor",
					"$ref": "https://webidetesting8346823-goio5drrj1.dispatcher.br1.hana.ondemand.com/destinations/USER_API/Groups/5d28844a90b0db20fb6608a4",
					"display": "OSP Proveedor"
				}, {
					"value": "OSP_Proveedor_Admin",
					"$ref": "https://webidetesting8345862-goio5drrj1.dispatcher.br1.hana.ondemand.com/destinations/USER_API/Groups/689343c5a0d22e7230594751",
					"display": "OSP Proveedor Admin"
				}],
				//	active: true,
				// Pediste llevar esto en el POST
				//	passwordStatus: "enabled",
				//		password: userData.contrasena
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
	_isFormValid: function () {
    const aControlIds = [
        "inputNombre",
        "countryComboBox",
        "inputEmail",
        "inputValidarEmail",
        "inputContrasena",
        "inputConfirmarContrasena",
        "inputCUIT",
        "inputRazonSocial"
    ];

    const that = this;
    let bFormValid = true;

    aControlIds.forEach(function (sId) {
        const oControl = that.byId(sId);
        if (!oControl) {
            return; // por si algún id no existe
        }

        // 1) Si tiene estado de error → formulario inválido
        if (oControl.getValueState && oControl.getValueState() === "Error") {
            bFormValid = false;
            return;
        }

        // 2) Si es requerido y está vacío → inválido
        if (oControl.getRequired && oControl.getRequired()) {
            // ComboBox
            if (oControl instanceof sap.m.ComboBox) {
                if (!oControl.getSelectedKey()) {
                    bFormValid = false;
                    return;
                }
            }
            // Input
            if (oControl.getValue) {
                if (!oControl.getValue().trim()) {
                    bFormValid = false;
                    return;
                }
            }
        }
    });

    return bFormValid;
},


		_updateFormState: function () {
			const bValid = this._isFormValid();
			this.getView().getModel("viewModel").setProperty("/formValid", bValid);
		}

	});
});