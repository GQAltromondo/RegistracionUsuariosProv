sap.ui.define([], function () {
	"use strict";

	return {
		validarEmail: function (email) {
			const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return regex.test(email);
		},

		validarContrasena: function (password) {
			const regex = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
			return regex.test(password);
		},
		isValidCuit: function (sValue) {
			if (!/^\d*$/.test(sValue)) {
				return {
					valid: false,
					text: "Solo se permiten números en el CUIT"
				};
			}

			if (!sValue.trim()) {
				return {
					valid: false,
					text: "Campo obligatorio"
				};
			}

			if (sValue.length !== 11) {
				return {
					valid: false,
					text: "El CUIT debe tener 11 dígitos"
				};
			}

			if (!this.validarCuit(sValue)) {
				return {
					valid: false,
					text: "CUIT inválido (verificador incorrecto)"
				};
			}

			return {
				valid: true
			};
		},
		 validarCuit: function (sValue) {
			if (!/^\d{11}$/.test(sValue)) return false;

			var mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
			var total = 0;

			for (var i = 0; i < mult.length; i++) {
				total += parseInt(sValue.charAt(i), 10) * mult[i];
			}

			var resto = total % 11;
			var digitoVerificador = resto === 0 ? 0 : resto === 1 ? 9 : 11 - resto;

			return digitoVerificador === parseInt(sValue.charAt(10), 10);
		}

	};
});