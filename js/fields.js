/* Field definitions and the terms text: taken unchanged from the Claude version. */
const DJ_FIELDS = [
  {id:'clientEmail', label:'E-mailadres', type:'email'},
  {id:'clientPhone', label:'Telefoonnummer', type:'tel'},
  {id:'eventType', label:'Type feest', type:'select', options:['','Huwelijk','Verjaardag','Jubileum','Corporate event','Sportevent','Festival','Andere']},
  {id:'eventDate', label:'Datum feest', type:'date'},
  {id:'venue', label:'Locatie feest', type:'text', placeholder:'Naam en adres'},
  {id:'priceExVat', label:'Prijs (excl. btw)', type:'number', placeholder:'€'},
  {id:'advanceAmount', label:'Voorschot', type:'number', placeholder:'€'},
  {id:'overtimeRate', label:'Tarief overuur', type:'number', placeholder:'€ / uur'},
  {id:'materials', label:'Te voorziene materialen', type:'select', options:['','Geen','Enkel controller','Basisopstelling','Grote installatie']},
  {id:'setupDate', label:'Opsteldatum', type:'date'},
  {id:'setupTime', label:'Opsteluur', type:'time'},
  {id:'djArrival', label:'Dj aanwezig om', type:'time'},
  {id:'startTime', label:'Startuur dj', type:'time'},
  {id:'endTime', label:'Einduur dj', type:'time'},
];
const INTERNAL_FIELD = {id:'internalNotes', label:'Interne notities (nooit zichtbaar voor de klant)', type:'textarea', full:true};
const CLIENT_FIELDS = [
  {id:'musicSuggestions', label:'Muzieksuggesties', type:'textarea', full:true, placeholder:'Link naar een Spotify-playlist en/of specifieke nummers'},
  {id:'doNotPlay', label:'Nummers of artiesten die NIET gespeeld mogen worden', type:'textarea', full:true},
  {id:'firstDance', label:'Openingsdans', type:'text', placeholder:'Artiest – titel (indien van toepassing)'},
  {id:'parentDance', label:'Ouder-kind dans', type:'text', placeholder:'Artiest – titel (optioneel)'},
  {id:'specialMoments', label:'Speciale momenten & timing', type:'textarea', full:true, placeholder:'Bv. taart aansnijden 22u, speeches na het eten...'},
  {id:'genres', label:'Gewenste muziekstijlen', type:'text'},
  {id:'vibe', label:'Gewenste sfeer doorheen de avond', type:'text', placeholder:'Bv. rustig starten, vanaf 22u losgaan'},
  {id:'announcements', label:'Aankondigingen voor de dj', type:'textarea', full:true, placeholder:'Bv. correcte uitspraak van namen'},
  {id:'onSiteContactAlt', label:'Extra contactpersoon', type:'text'},
  {id:'extraNotes', label:'Overige opmerkingen of wensen', type:'textarea', full:true},
];

// Article 1 shows the voorschot filled in for this dossier; if none was set,
// the standard €100 applies.
function termsHTML(form){
  const raw = form && form.dj && form.dj.advanceAmount ? String(form.dj.advanceAmount).trim() : '';
  const amount = raw ? '€' + escapeHtml(raw) : '€100';
  return TERMS_TEMPLATE.replace('{{VOORSCHOT}}', amount);
}
const TERMS_TEMPLATE = `
  <h4>1. Voorschot / bevestiging van de boeking</h4>
  <p>Bij bevestiging van de boeking wordt een voorschot van {{VOORSCHOT}} gevraagd.</p>
  <p>De boeking wordt pas definitief vastgelegd na ontvangst van dit voorschot.</p>
  <p>Het voorschot wordt verrekend met het totaalbedrag van de DJ-prestatie.</p>

  <h4>2. Annulatie door de klant</h4>
  <p>Bij annulatie van de boeking door de klant binnen 30 dagen vóór de geplande datum van het evenement, behoudt MK Soundsystem zich het recht voor om een schadevergoeding aan te rekenen van:</p>
  <p><strong>€100 excl. btw</strong></p>
  <p>Deze vergoeding dient ter compensatie van de gereserveerde datum, voorbereiding en mogelijke gemiste andere opdrachten.</p>
  <p>Bij annulatie buiten deze termijn worden geen annulatiekosten aangerekend, tenzij anders schriftelijk overeengekomen.</p>

  <h4>3. Overmacht</h4>
  <p>MK Soundsystem kan niet aansprakelijk worden gesteld wanneer het optreden niet kan doorgaan door omstandigheden buiten haar controle, zoals onder andere ziekte, ongeval, technische defecten, extreme weersomstandigheden, overheidsmaatregelen of andere situaties van overmacht.</p>
  <p>In geval van overmacht zal MK Soundsystem de klant zo snel mogelijk informeren en samen zoeken naar een passende oplossing, zoals het verplaatsen van de boeking indien mogelijk.</p>
  <p>Indien uitvoering van de overeenkomst definitief onmogelijk wordt door overmacht, kunnen beide partijen geen schadevergoeding eisen.</p>

  <h4>4. Verantwoordelijkheden</h4>
  <p>De klant zorgt voor:</p>
  <ul>
    <li>een veilige en geschikte locatie voor het optreden;</li>
    <li>voldoende ruimte en toegang voor het opstellen en afbreken van het materiaal;</li>
    <li>correcte informatie over locatie, timing en praktische afspraken.</li>
  </ul>
  <p>MK Soundsystem zorgt voor:</p>
  <ul>
    <li>de afgesproken muzikale begeleiding;</li>
    <li>het nodige DJ-materiaal, tenzij anders overeengekomen.</li>
  </ul>
`;
