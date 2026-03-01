sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sacde/RegistracionUsuariosProv/utils/Validations",
	"sacde/RegistracionUsuariosProv/utils/ModelHelper",
	"sacde/RegistracionUsuariosProv/utils/IASHelper",
	"sap/m/MessageToast",
	"sap/m/MessageBox"
], function (BaseController, Validations, ModelHelper, IASHelper, MessageToast, MessageBox) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.Register", {
		
		onInit: function () {
			this._Validation = Validations;
			ModelHelper.getModel(this.getView(), "viewModel").setData({
				formValid: false
			});
			this.getPaises();
			this.getRouter().getRoute("Register").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function () {
			const oView = this.getView();
			oView.byId("inputValidarEmail").setValue("");
			oView.byId("inputConfirmarContrasena").setValue("");
			const oUsuarioModel = new sap.ui.model.json.JSONModel({});
			this.getView().setModel(oUsuarioModel, "usuario");
		},
		getPaises: function () {
			const oDataModel = this.getOwnerComponent().getModel("oData");
			oDataModel.setUseBatch(false);

			const aFilters = [
				new sap.ui.model.Filter("NombreLista", sap.ui.model.FilterOperator.EQ, "PAISES")
			];

			const oViewModel = ModelHelper.getModel(this.getView(), "countryModel");
			oViewModel.setSizeLimit(1000);

			oDataModel.read("/ListasSet", {
				filters: aFilters,
				success: (data) => {
					const aResults = data.results || [];

					const aPaises = aResults.filter(r =>
						String(r.NombreLista || "").trim().toUpperCase() === "PAISES"
					);

					aPaises.sort((a, b) =>
						String(a.Texto || "").localeCompare(String(b.Texto || ""), "es")
					);

					oViewModel.setProperty("/countries", aPaises);
				},
				error: (oError) => {
					jQuery.sap.log.error("Error al cargar países:", oError);
					MessageToast.show("No se pudieron cargar los países.");
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

			aCampos.forEach(({ key, id }) => {
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
				MessageBox.error("Los emails no coinciden.");
				return;
			}

			if (oUser.contrasena !== sPasswordConfirm) {
				oView.byId("inputConfirmarContrasena").setValueState("Error");
				oView.byId("inputConfirmarContrasena").setValueStateText("Las contraseñas no coinciden");
				MessageBox.error("Las contraseñas no coinciden.");
				return;
			}

			// Si hay campos incompletos, detener
			if (bError) {
				MessageBox.warning("Por favor, complete todos los campos obligatorios.");
				return;
			}

			const sEntitySet = "/ApplicationLoginSet";
			const oModel = oView.getModel("oData");

			// Payload para DB: contrasena vacía (login solo vía IAS, clave solo en IAS)
			const oUserDb = jQuery.extend({}, oUser);
			oUserDb.contrasena = "";

			this.showBusy();

			oModel.create(sEntitySet, oUserDb, {
				success: async () => {
					// Crear usuario en IAS con contraseña (no se envía email de cambio - configurar en IAS)
					try {
						await IASHelper.createUser({
							email: oUser.email,
							nombre: oUser.usuario,
							pais: oUser.pais,
							password: oUser.contrasena,
							cuit: oUser.cuit,
							customAttribute2: oUser.cuit
						}, true); // true = es admin
					} catch (e) {
						// IASHelper ya muestra el error
					}
					
					this.hideBusy();
					MessageToast.show("Registro creado exitosamente.");
					this.navTo("Login");
				},
				error: (oError) => {
					this.hideBusy();
					const sMsg = this.parseError(oError, "Error al crear el registro.");
					MessageBox.error(sMsg);
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
			this.navTo("Main");
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