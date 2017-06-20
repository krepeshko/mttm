/*
 * object to handle sanitation / validation of dutch phone/fax-numbers.
 */
//jQuery( document ).ready(function() {
//jQuery.noConflict();
jQuery(window).load(function () {
	telefax = function (data) {
		this.data = '';
		if (data)
			this.sanitize(data);
	};
	telefax.prototype = {
		'sanitize': function (data) {
			if (data)
				this.data = data;
			var v = this.data
					.replace(/\(0\)/, "")		// remove +31 (0) 10 ...
					.replace(/[^+0-9]/g, "");
			if (v.length > 1 && v.substring(0, 1) == "+")
				v = "00" + v.substring(1, v.length);
			this.data = v;
			return this.data;
		},
		'validate': function (data) {
			if (data)
				this.sanitize(data);
			return /^(0031|0)(((800|90[069])([0-9]{4}|[0-9]{7}))|([1-9]{1}[0-9]{8}))$/.test(this.data);
		}
	};
	/* validation stuff */
	jQuery.validator.addMethod(
			"postcode",
			function (val, el) {
				return this.optional(el) || /^[0-9]{4}\s?[a-zA-Z]{2}$/.test(val);
			},
			"Vul een geldige postcode in, bv 1234AA"
			);

	jQuery.validator.addMethod(
			"telefax",
			function (val, el) {
				var telfax = new telefax(val);
				return this.optional(el) || telfax.validate();
			},
			"Vul een geldig telefoonnummer in"
			);

	jQuery.validator.addMethod(
			"bankrekening",
			function (val, el) {
				return this.optional(el) || /^[0-9a-zA-Z]{18}$/.test(val);
			},
			"Vul een geldig bankrekeningnummer in."
			);

	jQuery.validator.messages.required = "Dit is een verplicht veld.";

	jQuery('#companyInfo').attr('hidden', 'true');
	jQuery('.result_form').attr('style', 'display: none;');
	jQuery('.search-result').attr('hidden', 'true');

	function setup_aska() {
		var $main = jQuery("form.aska-kvk");
		$main.prepend("<input id='loginId' name='loginId' type='hidden'>");
		$main.prepend("<input id='numberLoginId' name='numberLoginId' type='hidden'>");
		var $loading = jQuery(".loading");
		$loading.attr('style', 'background: url("/wp-content/themes/zn_v1.0/images/ajax-loader.gif") no-repeat scroll 0 1px transparent; padding-left: 20px;');
		$loading.hide();

		var xhr,
			selectedNumber,
			ac_buffer = {},
			org_buffer = {},
			contact_buffer = {},
			aska_generated_class = "aska-generated",
			kvk_url = "/see.php",
			$naam = $main.find(".kvknaam"),
			$nummer = $main.find(".kvknummer"),
			$adres = $main.find(".adres"),
			$mail = $main.find(".email"),
			$postcode = $main.find(".postcode"),
			$plaats = $main.find("#plaats"),
			$api = $main.find("fieldset.kvk-api").hide(),
			$form = $main.find("fieldset.kvk-form"),
			$loginId = $main.find("#loginId"),
			$numberLoginId = $main.find("#numberLoginId"),
			validator,
			telfax = new telefax,
			validator_opt = {
				"rules": {
					"kvknaam": "required",
					"email": {
						"required": true,
						"email": true
					},
					"telefoon": {
						"required": true,
						"telefax": true
					}
				},

				"messages": {
					"kvknaam": {"required": "Vult u uw bedrijfsnaam in."},
					"email": {
						"required": "Vult u uw e-mailadres in.",
						"email": "Vul een geldig e-mailadres in."
					},
					"telefoon": {"required": "Vul uw telefoonnummer in."}
				},

				"errorPlacement": function (er, el) {
					if (el.is(".group-error > input")) {
						el.parent().after(er);
					} else {
						el.after(er);
					}
				},

				"submitHandler": function (form) {
					jQuery(form)
							.find("button")
							.replaceWith(
									"<span class=\"loading\">Uw aanvraag wordt verstuurd, dit kan even duren.</span>"
									);
					form.submit();
				}
			},
			person = {
				"$voornaam": $main.find("input.voornaam"),
				"$tussenvoegsel": $main.find("input.tussenvoegsel"),
				"$achternaam": $main.find("input.achternaam"),
				"$telefoon": $main.find("input#telefoon"),
				"$geslacht": $main.find("input.geslacht"),
				"$fax": $main.find("input.fax"),
				"$email": $main.find("input.email"),
				"reset": function (org_id) {
					var j = org_buffer[org_id];
					// person.$voornaam.filter("." + aska_generated_class).val("");
					// person.$tussenvoegsel.filter("." + aska_generated_class).val("");
					// person.$achternaam.filter("." + aska_generated_class).val("");
					// person.$telefoon.filter("." + aska_generated_class).val(j.telefoon);
					person.$fax.filter("." + aska_generated_class).val(j.fax);
					// person.$email.filter("." + aska_generated_class).val(j.email);
					$main.find(".bankrekening").filter("." + aska_generated_class).val(j.bankrekening);
				},

				"set": function (what, with_what) {
					if (with_what && with_what.length > 0) {
						person[what].val(with_what);
					}
				}
			},
			show = function (api) {
				if (api) {
					$form.hide();
					$api.show();
					$api.find(":checkbox").attr("checked", "checked");
				} else {
					$api.hide();
					$form.show();
					//$api.find(":checkbox").attr("checked", "");
				}
			},
			build_user = function (orgId, contactId) {
				var contact = contact_buffer[orgId].contacts["contact-" + contactId];
				person.set("$email", contact.email);
				person.set("$telefoon", telfax.sanitize(contact.telefoon));
				person.set("$fax", telfax.sanitize(contact.fax));
				person.set("$geslacht", contact.geslacht);
				person.$voornaam.val(contact.voornaam);
				person.$tussenvoegsel.val(contact.tussenvoegsel);
				person.$achternaam.val(contact.achternaam);
				if (contact.geslacht.length > 0) {
					person.$gender.val(contact.geslacht);
				}
				jQuery(".person").show();
				validator.form();
			},
			// haal en bouw een lijst van contactpersonen voor deze organisatie
			build_users = function (id) {
				if (!contact_buffer[id]) {
					contact_buffer[id] = {};
					jQuery.get(kvk_url, {
						"id": id,
						"t": "companyid",
						"loginId" : jQuery("#loginId").val()
					}, function (contacten) {
						if (
								contacten &&
								contacten.length > 0 &&
								contacten[0].OrganisationId
								) {
							var contacts = {};
							jQuery.each(
									contacten,
									function () {
										contacts["contact-" + this.ContactPersonId] = {
											"voornaam": this.Initials || this.FirstName,
											"tussenvoegsel": this.infix,
											"achternaam": this.LastName,
											"telefoon": telfax.sanitize(this.PhoneGeneral),
											"fax": telfax.sanitize(this.FaxGeneral),
											"email": this.EmailAddressGeneral,
											"geslacht": this.Gender
										};
									}
							);
							contact_buffer[id].length = contacten.length;
							contact_buffer[id].contacts = contacts;
							build_users(id);
						}
					}, "json");
				}
				jQuery(".person-options").hide();
				jQuery(".person").show();
				if (contact_buffer[id].length == 1) {
					for (var i in contact_buffer[id])
						build_user(id, i); // only one
				} else if (contact_buffer[id].length > 1) {
					var option = [];
					jQuery.each(contact_buffer[id].contacts, function (idx, el) {
						option.push(
								"<option value=\"" + idx + "-" + id + "\">" + el.voornaam + " " + (el.tussenvoegsel || "") + "" + el.achternaam + " " + "</option>"
								);
					});
					option.push("<option value=\"org-" + id + "\">Anders</option>");
					jQuery(".person-options").show().find("select").html(option.join("")).change();
				}
			},
			// vul de persoonsgegevens van deze persoon
			fill = function (result) {
				if (!result) {
					return;
				}

				setLoginId(result.loginId);

				var j = result.res;
				$loading.hide(); // loading
				if (j) {
					org_buffer[j.OrganisationId] = {
						"naam": j.Name,
						"kvk": j.KvKNumber,
						"adres":
								j.AddressResidenceStreetName + " " +
								j.AddressResidenceStreetNumber,
						"postcode": j.AddressResidencePostalCode,
						"plaats": j.AddressResidenceCityName,
						"email": j.EmailAddressGeneral,
						"telefoon": telfax.sanitize(j.PhoneGeneral),
						"fax": telfax.sanitize(j.FaxGeneral),
						"bankrekening": j.BankAccountNumber
					};
					$naam.val(j.Name);
					$nummer.val(j.KvKNumber).change();
					// "overige" velden zetten
					person.reset(j.OrganisationId);
				//				Geen contacts ophalen uit AskA
							//build_users(j.OrganisationId);
					$main.find("#askaid").val(j.OrganisationId);
					$api.find(".adres").text(org_buffer[j.OrganisationId].adres);
					$form.find(".adres").val(org_buffer[j.OrganisationId].adres);
					$adres.val(org_buffer[j.OrganisationId].adres);
					$api.find(".email").text(org_buffer[j.OrganisationId].email);
					$form.find(".email").val(org_buffer[j.OrganisationId].email);
					// $mail.val(org_buffer[j.OrganisationId].email);
					$api.find(".postcode").text(org_buffer[j.OrganisationId].postcode);
					//$form.find("#postcode").val(org_buffer[j.OrganisationId].postcode);
					$postcode.val(org_buffer[j.OrganisationId].postcode);
					$api.find(".plaats").text(org_buffer[j.OrganisationId].plaats);
					//$form.find("#plaats").val(org_buffer[j.OrganisationId].plaats);
					$plaats.val(org_buffer[j.OrganisationId].plaats);

					// jQuery("#telefoon").val(org_buffer[j.OrganisationId].telefoon);
					// jQuery("#emailpersoonlijk").val(org_buffer[j.OrganisationId].email);
					jQuery(".fax").val(org_buffer[j.OrganisationId].fax);
					jQuery("#bankrekening")
						.val(org_buffer[j.OrganisationId].bankrekening ? org_buffer[j.OrganisationId].bankrekening : '');
					show(
							false === (
									j.Name.length == 0 ||
									!j.EmailAddressGeneral || j.EmailAddressGeneral.length == 0 ||
									!j.AddressResidenceStreetName || j.AddressResidenceStreetName.length == 0 ||
									!j.AddressResidencePostalCode || j.AddressResidencePostalCode.length == 0 ||
									!j.AddressResidenceCityName || j.AddressResidenceCityName.length == 0
									)
							);
					validator.form();
					// if ($main.find(".aska-content:not(:visible)"))
					// 	$main.find(".aska-content").show();
					// send event
				// $main.trigger("aska.loaded", j);
				} else {
					show(false);
				}
			},
			load_aska = function (term, response) {
				$loading.show(); // loading
				var requestParameters = {
					"t": "getCompanies",
					"loginId" : jQuery("#loginId").val(),
					"companyName": term
				};
				xhr = jQuery.get(kvk_url, requestParameters, function (result) {
					$loading.hide(); // loading
					if (!result) {
						return;
					}

					setLoginId(result.loginId);

					var companies = [];
					if (result.res) {
						companies = result.res;
					}

					response(companies);
				}, "json");
			},
			load_aska_id = function (companyId, companyName) {
				$loading.show();
				jQuery.get(
					kvk_url, 
					{
						"t": "getCompany",
						"loginId" : jQuery("#loginId").val(),
						"companyId": companyId,
						"companyName": companyName
					}, 
					fill,
					'json'
				);
			};

		if (jQuery("form").is(".aska-contact")) {
			validator_opt.rules["naam"] = "required";
			validator_opt.messages["naam"] = {"required": "Vul a.u.b. uw naam in."};
		} else {
			validator_opt.rules.kvknummer = {
				"required": true,
				"digits": true,
				"minlength": 8
			};
			validator_opt.rules.voornaam = "required";
			validator_opt.rules.achternaam = "required";
			validator_opt.rules.adres = "required";
			validator_opt.rules.fax = "telefax";
			validator_opt.rules.plaats = "required";
			validator_opt.rules.postcode = {
				"postcode": true,
				"required": true
			};
			validator_opt.rules.telefoon = {
				"required": true,
				"telefax": true
			};
			validator_opt.rules.bankrekening = {
				"bankrekening": true
			};
			// messages
			validator_opt.messages.kvknummer = {
				"required": "Vult u uw KvK nummer in.",
				"digits": "Een KvK nummer bestaat alleen uit nummers.",
				"minlength": "Een KvK nummer heeft 8 cijfers."
			};
			validator_opt.messages.fax = {"telefax": "Vul een geldig faxnummer in."};
			validator_opt.messages.adres = {"required": "Vul een volledig bedrijfsadres in."};
			validator_opt.messages.postcode = {"required": "Vul een volledig bedrijfsadres in."};
			validator_opt.messages.plaats = {"required": "Vul een volledig bedrijfsadres in."};
			validator_opt.messages.voornaam = {"required": "Vul de naam van een (tekeningsbevoegd) contactpersoon in."};
			validator_opt.messages.achternaam = {"required": "Vul de naam van een (tekeningsbevoegd) contactpersoon in."};
			validator_opt.messages.bankrekening = {"bankrekening": "Vul een geldig bankrekeningnummer in."};
			// groups
			validator_opt.groups = {
				"naam": "achternaam voornaam",
				"adres": "adres postcode plaats"
			};
		}

		validator = $main.validate(validator_opt);
		jQuery(".person-options").hide().find("select").change(function () {
			var ids = jQuery(this).val().split("-");
			if (ids.length > 2)
				build_user(ids[2], ids[1]);
			else if (ids.length > 1)
				person.reset(ids[1]);
		});

		/* haal de gegevens op adhv de blur op de inputs */
		$nummer.blur(function (ev) {
			var $tar = jQuery(ev.target),
				opt = {};
			$loading.show();
			opt[$tar.attr("name")] = $tar.val();
			opt["t"] = "companykvk";
			opt["loginId"] = jQuery("#loginId").val();
			jQuery.get(kvk_url, opt, function (j) {
				$loading.hide();
				fill(j);
			}, "json");
		});

		new autoComplete({
			selector: 'input[name="kvknaam"]', 
			source: function(term, response) {
				try { xhr.abort(); } catch(e){}
				load_aska(term, response);
			},
			offsetTop: 0,
			minChars: 3,
			renderItem: function(item, search){
				return '<div class="autocomplete-suggestion"'
					+ ' data-organisationId="' + item.OrganisationId + '"'
					+ ' data-name="' + item.Name + '"'
					+ '>'
					+ item.Name + ' ' + item.AddressResidenceCityName
					+ '</div>';
			},
			onSelect: function(event, term, item) {
				var organisationId = item.getAttribute('data-organisationId');
				var name = item.getAttribute('data-name');
				if (organisationId && name) {
					load_aska_id(organisationId, name);
				}
			}
		});

		// if ($naam.length > 0 && $naam.val().length > 3) {
		// 	load_aska($naam.val(), function (j) {
		// 		j[0] && j[0].id && load_aska_id(j[0].id);
		// 	});
		// }
		$api.find(":checkbox").change(function () {
			show(jQuery(this).is(":checked"));
		});
		$main.find("input:text[value=\"\"]")
			.addClass(aska_generated_class)
			.one("keypress", function (ev) {
				jQuery(this).removeClass(aska_generated_class);
			});
		if ($main.is(".show-on-company")) {
			$main.find(".aska-content").hide();
		}

		jQuery.get(
			kvk_url,
			{
				t: 'getGroupedNumbers'
			},
			function(res) {
				if (res) {
					jQuery("#numberLoginId").val(res.loginId);
					setGroupedNumbers(res.res.groupedNumbers);
					jQuery('#numbersTable .numbers-block').addClass('is-visible');
				}
			},
			"json"
		)
		.always(function() {
			jQuery.get(
				kvk_url,
				{
					t: 'getNumbersInStock',
					numberLoginId: jQuery("#numberLoginId").val()
				},
				function(res) {
					if (res) {
						jQuery("#numberLoginId").val(res.loginId);
						setNumbersInStock(res.res.numbersInStock);
						jQuery('#numbersStockTable .numbers-block').addClass('is-visible');
					}
				},
				"json"
			);
		});

		// jQuery.get(
		// 	kvk_url,
		// 	{
		// 		t: 'getNumberLoginId'
		// 	},
		// 	function(res) {
		// 		if (res) {
		// 			jQuery("#numberLoginId").val(res);
		// 		}
		// 	},
		// 	"json"
		// )
		// .always(function() {
		// 	jQuery.get(
		// 		kvk_url,
		// 		{
		// 			t: 'getNumbers'
		// 		},
		// 		function(res) {
		// 			if (res) {
		// 				jQuery("#numberLoginId").val(res.loginId);
		// 				setGroupedNumbers(res.res.groupedNumbers);
		// 				setNumbersInStock(res.res.numbersInStock);
		// 			}
		// 		},
		// 		"json"
		// 	);
		// });

		function setLoginId(loginId) {
			if (loginId) {
				jQuery('#loginId').val(loginId);
			}
		}

		function setGroupedNumbers(numbers) {
			// var blocks = ['0800', '0900', '088', '085', '00800'];
			var blocks = ['0800', '0900', '088', '085'];
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				jQuery('#' + block).html(buildBlock(numbers[block]));
			}
		}

		function setNumbersInStock(numbers) {
			var blocks = ['0800', '0900', '088', '085'];
			for (var i = 0; i < blocks.length; i++) {
				var block = blocks[i];
				jQuery('#stock-' + block).html(buildBlock(numbers[block]));
			}
			// jQuery('.stock-table').html(buildBlock(numbers));
		}

		function buildBlock(numbers) {
			var htmlBlock = '';
			for (var i = 0; i < numbers.length; i++) {
				htmlBlock += '<tr><td class="numbers-number">' + numbers[i] + '</td></tr>';
			}

			return htmlBlock;
		}

		jQuery('#numbersTable').click(function(event) {
			isClickTd(this, event.target);
		});

		jQuery('#numbersStockTable').click(function(event) {
			isClickTd(this, event.target);
		});

		jQuery('#searchNumbers').click(function(event) {
			isClickTd(this, event.target);
		});

		function isClickTd(table, target) {
			while (target != table) {
				if (target.tagName == 'TD') {
					if (jQuery(target).hasClass('numbers-number')) {
						highlight(target);
					}
					return;
				}
				target = target.parentNode;
			} 
		}

		function highlight(node) {
			if (selectedNumber) {
				selectedNumber.classList.remove('numbers-highlight');
			}
			selectedNumber = node;
			selectedNumber.classList.add('numbers-highlight');
		}

		jQuery('#numbersSearchButton').click(function(event) {
			var prefix = jQuery('#numberPrefix').val();
			var number = jQuery('#numbersSearchBox').val();

			if (!number) {
				return;
			}

			jQuery.get(
				kvk_url,
				{
					t: 'getFilterNumbers',
					numberLoginId: jQuery("#numberLoginId").val(),
					prefix: prefix,
					number: number
				},
				function(result) {
					if (result) {
						jQuery("#numberLoginId").val(result.loginId);
						if (result.res) {
							if (result.res.length > 0) {
								jQuery('.search-result').removeAttr('hidden');
							}
							jQuery('#searchNumbers').html(buildBlock(result.res));
							jQuery('.search-result').slideDown();
						}
					}
				},
				"json"
			);
		});

		jQuery('#numbersBestellen').click(function(event) {
			if (selectedNumber) {
				jQuery('#askform').attr('style', 'display: block !important;');
				jQuery('.result_form').attr('style', 'display: block !important;');
				jQuery("#sn").val(selectedNumber.innerHTML);
				jQuery('#numbers-content').attr('hidden', 'true');
			}
		});

		jQuery('#personInfo input[name="verder"]').click(function(event) {
			var voornaam = jQuery('input[name="voornaam"]');
			var tussenvoegsel = jQuery('input[name="tussenvoegsel"]');
			var achternaam = jQuery('input[name="achternaam"]');
			var emailpersoonlijk = jQuery('input[name="emailpersoonlijk"]');
			var telefoon = jQuery('input[name="telefoon"]');
			var isValid = voornaam.valid() && tussenvoegsel.valid() && achternaam.valid() && emailpersoonlijk.valid() && telefoon.valid();
			if (!isValid) {
				return;
			}

			setTimeout(function() {
				jQuery("form.aska-kvk").validate().resetForm();
			}, 10);

			jQuery('#companyInfo').removeAttr('hidden');
			jQuery('#div[name="personInfo"]').attr('hidden', 'true');
			
			jQuery.get(
				kvk_url,
				{
					t: 'sendUserInfo',
					voornaam: voornaam.val(),
					tussenvoegsel: tussenvoegsel.val(),
					achternaam: achternaam.val(),
					emailpersoonlijk: emailpersoonlijk.val(),
					telefoon: telefoon.val(),
					number: jQuery('#sn').val()
				},
				function(res) {
					if (res) {
						jQuery("#numberLoginId").val(res.loginId);
						setGroupedNumbers(res.res.groupedNumbers);
					}
				},
				"json"
			);
		});
	}

	// setTimeout(setup_aska, 100);
	setup_aska();


	function servicenumbersprefix() {
		var prefix = '090004';
		var companyname = '011jm';
		jQuery.get(
			"/see.php",
			{
				prefix: prefix,
				companyname: companyname,
				t: "servicenumbersprefix"
			}, 
			function(result) {
				console.log(result);
			},
			'json'
		); 
	}

	// servicenumbersprefix();
	
	jQuery('#comp').keyup(
		function(eventObject){

				if (
								jQuery("#comp").length > 0 &&
								jQuery("#comp").val().length > 3
						) {        
				
				
		jQuery.get(
		"/see.php",
		{
			prefix: jQuery("#prefix").val(),
			companyname: jQuery("#comp").val(),
			t: "servicenumbersprefix"
		}, function(data) {
			alert(data);
			}
		);     
						}   
		
		
		}
	);

	jQuery('#sel1').click(
		function(){
		var cssrs=jQuery("#good-text").css("display");
		if (cssrs=='inline-block'){
		var rs=jQuery("#prefix3").val()+jQuery("#numb").val();	 
		jQuery("#sn").val(rs);
		jQuery("#sn1").val(rs);
		jQuery.get(
		"/see.php",
		{
			prefix: jQuery("#prefix3").val(),
			t: "prices"
		}, function(data) {
		jQuery("#priceres").html("Price: € "+data+",- per maand");
		jQuery(".price-form").css("display","block");

			}
		);
		}
				
		}
	);

	jQuery('#sel2').click(
		function(){
		if (jQuery("#resc").val()!=''){
		var rs1=jQuery("#resc").val();	 
		jQuery("#sn").val(rs1);
		jQuery("#sn1").val(rs1);
		jQuery.get(
		"/see.php",
		{
			prefix: jQuery("#prefix3").val(),
			t: "prices"
		}, function(data) {
		jQuery("#priceres").html("Price: € "+data+",- per maand");
		jQuery(".price-form").css("display","block");

			}
		);
		}
			
		}
	);


});


	// function gotxt(v,p){	
	// 	if (v=='Selecteer'){ 	
	// 	jQuery("#selecteer").attr("style", "background:#20c7f7 none repeat scroll 0 0 !important;");	
	// 	}
	// 	switch (jQuery("#"+p).val()) {
	// 							case '0800':	
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 0800 servicenummer. U kunt kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u zelf naar welk telefoonnummer uw 0800 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. Bij een 0800 servicenummer heeft u daarnaast de mogelijkheid om te kiezen of u bereikbaar bent voor mobiele telefoonnummers, of dat u misschien alleen door vaste nummers gebeld wilt worden. U kunt deze en meer opties bespreken met uw accountmanager"); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	}
	// 								break;
	// 							case '088':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 088 servicenummer. U kunt kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 088 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. Let op, belt u via VoIP? Dan zijn er nóg meer mogelijkheden. U kunt deze en meer opties bespreken met uw accountmanager."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	}
	// 								break;
	// 							case '00800':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 00800 internationaal servicenummer. U betaalt eenmalig aansluitkosten á € 90,- vermeerderd met € 8,- activatiekosten per land van waaruit u bereikbaar wilt zijn op uw internationale servicenummer. U kunt kiezen voor een 1, 2 of 3- jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 00800 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. U kunt deze en meer opties bespreken met uw accountmanager."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	} 
	// 								break;
	// 							case '085':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 085 servicenummer. U kunt kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 085 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. Let op, belt u via VoIP? Dan zijn er nóg meer mogelijkheden. U kunt deze en meer opties bespreken met uw accountmanager."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	} 
	// 								break;
	// 							case '0900':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 0900 servicenummer. U betaalt uw verdienmodel en kunt het tarief voor de beller en dus uw eigen opbrengst zelf instellen. Heeft u de opbrengstentabel al bekeken? Bij een 0900 servicenummer kunt u kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 0900 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. U kunt deze en meer opties bespreken met uw accountmanager.."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	} 
	// 								break;
	// 							case '0903':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 0903 servicenummer. U betaalt uw verdienmodel en kunt het tarief voor de beller en dus uw eigen opbrengst zelf instellen. Heeft u de opbrengstentabel al bekeken? Bij een 0900 servicenummer kunt u kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 0900 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. U kunt deze en meer opties bespreken met uw accountmanager.."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	} 
	// 								break;
	// 							case '0909':
	// 	if (v=='Selecteer'){                      						
	// 	jQuery("#tres").text("U kiest voor een 0909 servicenummer. U betaalt uw verdienmodel en kunt het tarief voor de beller en dus uw eigen opbrengst zelf instellen. Heeft u de opbrengstentabel al bekeken? Bij een 0900 servicenummer kunt u kiezen voor een 1, 2 of 3-jarig abonnement. Ook bepaalt u naar welk telefoonnummer uw 0900 servicenummer wordt doorgeschakeld. Dit doet u in uw persoonlijke portal. U kunt deze en meer opties bespreken met uw accountmanager.."); 
	// 	} else {
	// 	if (v=='Kies ander servicenummer'){   	
	// 	jQuery("#tres").text("Maak hierboven een keuze voor uw servicenummer");	
	// 	}
	// 	}
	// 								break;
	// 						} 	
	// 	jQuery("#pricer").val(jQuery("#priceres").text());                    
	// 	jQuery("#pricedesc").val(jQuery("#tres").text());  
	// }		
	// function numbpref(){
	// 	jQuery("#sn").val('');
	// 	jQuery(".price-form").css("display","none");
	// 	jQuery("#tres").text('');  
	// 	jQuery("#pricer").val('');                    
	// 	jQuery("#pricedesc").val(''); 
	// 	jQuery("#load_data").css("display","inline-block"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");
	// 	jQuery("#error_prefix").css("display","none"); 
	// 	var nmb=jQuery("#numb").val();
	// 	var lns=nmb.length;
	// 	var gosee=1;
		
	// 	var reg = /[0-9]/;
	// 	var res=true;
	// 			for(i=0; i<nmb.length; i++){
	// 				var rez=reg.test(nmb[i]);
					
	// 				if (rez===false){
	// 					res=false;
	// 					}
	// 			}
		
	// 	switch (jQuery("#prefix3").val()) {
	// 							case '0800':
	// 							if (((lns!=4) && (lns!=7)) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}    
	// 								break;
	// 							case '088':
	// 							if ((lns!=7) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '00800':
	// 							if ((lns!=8) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 8 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '085':
	// 							if ((lns!=7) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0900':
	// 							if (((lns!=4) && (lns!=7)) || (res===false)){
	// 	gosee=0;		
	// 	jQuery("#error_prefix").text("Vul 4 of 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0903':
	// 							if (((lns!=4) && (lns!=7)) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0909':
	// 							if (((lns!=4) && (lns!=7)) || (res===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 cijfers in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 						} 
	// 	if (gosee==1){
			
	// 	var numbr=jQuery("#prefix3").val()+jQuery("#numb").val();        
	// 	jQuery.ajax({
	// 	type: "GET",
	// 	cache: false,
	// 	url: '/see.php',
	// 	data: "number="+numbr+"&t=servicenumbersnumber",
	// 	success: function(data1){ 
	// 		if (data1=='notfound'){
	// 		jQuery("#good-text").css("display","none");  
	// 		jQuery("#load_data").css("display","none"); 
	// 		jQuery("#error_prefix").css("display","none"); 
	// 		jQuery("#error-text").css("display","inline-block");      

	// 		} else {
	// 		jQuery("#error-text").css("display","none");
	// 		jQuery("#load_data").css("display","none"); 
	// 		jQuery("#error_prefix").css("display","none"); 
	// 		jQuery("#good-text").css("display","inline-block");
	// 		}

	// 	}
	// 	});        
	// 	}        
	// } 
	// function numbpref1(){
	// 	jQuery("#sn").val('');
	// 	jQuery(".price-form").css("display","none");
	// 	jQuery("#tres").text('');  
	// 	jQuery("#pricer").val('');                    
	// 	jQuery("#pricedesc").val(''); 
	// 	jQuery.get(
	// 	"/see.php",
	// 	{
	// 		prefix: jQuery("#prefix3").val(),
	// 		t: "prefix"
	// 	}, function(data) {
	// 		if (data!='notfound1'){
	// 		jQuery("#resc").html(data);
	// 		}  
			
	// 		}
	// 	);  

	// }
	// function numbpref0(){
	// 	jQuery("#sn").val('');
	// 	jQuery(".price-form").css("display","none");
	// 	jQuery("#tres").text('');
	// 	jQuery("#sn01").text('');
	// 	jQuery("#pricer").val('');                    
	// 	jQuery("#pricedesc").val(''); 	
	// 	jQuery("#load_data").css("display","inline-block"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");
	// 	jQuery("#error_prefix").css("display","none");
	// 	var reg = /[A-Za-z0-9]/;
	// 	var nmb22=jQuery('#numb0').val();  
	// 	var ress=true;
	// 			for(i=0; i<nmb22.length; i++){
	// 				var rez=reg.test(nmb22[i]);
					
	// 				if (rez===false){
	// 					ress=false;
	// 					}
	// 			} 
	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/a/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/b/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/c/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/d/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/e/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/f/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/g/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/h/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/i/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/j/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/k/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/l/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/m/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/n/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/o/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/p/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/q/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/r/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/s/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/t/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/u/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/v/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/w/g, "9");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/x/g, "9");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/y/g, "9");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/z/g, "9");
	// 					document.getElementById("demo").innerHTML = res;
	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/A/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/B/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/C/g, "2");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/D/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/E/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/F/g, "3");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/G/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/H/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/I/g, "4");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/J/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/K/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/L/g, "5");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/M/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/N/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/O/g, "6");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/P/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/Q/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/R/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/S/g, "7");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/T/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/U/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/V/g, "8");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/W/g, "9");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/X/g, "9");
	// 					document.getElementById("demo").innerHTML = res;


	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/Y/g, "9");
	// 					document.getElementById("demo").innerHTML = res;

	// 					var str = document.getElementById("demo").innerHTML;
	// 					var res = str.replace(/Z/g, "9");
	// 					document.getElementById("demo").innerHTML = res;	
	// 	var nmb=document.getElementById("demo").innerHTML; 	
	// 	var lns=nmb.length;
	// 	var gosee=1;

	// 	switch (jQuery("#prefix1").val()) {
	// 							case '0800':
	// 							if ((lns!=4) && (lns!=7) || (ress===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}    
	// 								break;
	// 							case '088':
	// 							if ((lns!=7) || (ress===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 7 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '00800':
	// 							if ((lns!=8) || (ress===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 8 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '085':
	// 							if ((lns!=7) && (ress===true)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 7 karakters in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0900':
	// 							if (((lns!=4) && (lns!=7)) || (ress===false)){
	// 	gosee=0;		
	// 	jQuery("#error_prefix").text("Vul 4 of 7 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0903':
	// 							if (((lns!=4) && (lns!=7)) || (ress===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 							case '0909':
	// 							if (((lns!=4) && (lns!=7)) || (ress===false)){
	// 	gosee=0;							
	// 	jQuery("#error_prefix").text("Vul 4 of 7 karakters (cijfers of letters) in");
	// 	jQuery("#error_prefix").css("display","inline-block");
	// 	jQuery("#load_data").css("display","none"); 
	// 	jQuery("#good-text").css("display","none");     
	// 	jQuery("#error-text").css("display","none");  
	// 							}
	// 								break;
	// 						}  


	// 	if (gosee==1){
			
	// 	var numbr=jQuery("#prefix1").val()+document.getElementById("demo").innerHTML;      
	// 	jQuery.ajax({
	// 	type: "GET",
	// 	cache: false,
	// 	url: '/see.php',
	// 	data: "number="+numbr+"&t=servicenumbersnumber",
	// 	success: function(data1){ 
	// 		if (data1=='notfound'){
	// 		jQuery("#good-text").css("display","none");  
	// 		jQuery("#load_data").css("display","none"); 
	// 		jQuery("#error_prefix").css("display","none"); 
	// 		jQuery("#error-text").css("display","inline-block");      

	// 		} else {
	// 		jQuery("#error-text").css("display","none");
	// 		jQuery("#load_data").css("display","none"); 
	// 		jQuery("#error_prefix").css("display","none"); 
	// 		jQuery("#good-text").css("display","inline-block");
	// 		jQuery("#sn01").text(numbr);
			
	// 		}

	// 	}
	// 	});        
	// 	} 

	// }	
	// function sel3(){
	// 	var cssrs=jQuery("#good-text").css("display");
	// 	if (cssrs=='inline-block'){
	// 	var rs=jQuery("#sn01").text();	 
	// 	jQuery("#sn11").val(rs);
	// 	jQuery("#sn").val(rs);
	// 	jQuery.get(
	// 	"/see.php",
	// 	{
	// 		prefix: jQuery("#prefix1").val(),
	// 		t: "prices"
	// 	}, function(data) {
	// 	jQuery("#priceres").html("Price: € "+data+",- per maand");
	// 	jQuery(".price-form").css("display","block");

	// 		}
	// 	);

	// 	}
	// }
	// function numbpref2(){
	// 	jQuery("#sn").val('');
	// 	jQuery(".price-form").css("display","none");
	// 	jQuery("#tres").text('');  
	// 	jQuery("#pricer").val('');                    
	// 	jQuery("#pricedesc").val(''); 
	// 	jQuery.get(
	// 	"/see.php",
	// 	{
	// 		prefix: jQuery("#prefix2").val(),
	// 		t: "servicenumberspretty"
	// 	}, function(data) {
	// 		if (data!='notfound1'){
	// 		jQuery("#resc2").html(data);
	// 		}  
			
	// 		}
	// 	);  
	// }
	// function numbpref5(){
	// 	var rs1=jQuery("#resc2").val();	 
	// 	jQuery("#sn").val(rs1);
	// 	jQuery("#sn1").val(rs1);
	// 	jQuery.get(
	// 	"/see.php",
	// 	{
	// 		prefix: jQuery("#prefix2").val(),
	// 		t: "prices"
	// 	}, function(data) {
	// 	jQuery("#priceres").html("Price: € "+data+",- per maand");
	// 	jQuery(".price-form").css("display","block");

	// 		}
	// 	);	
	// }

