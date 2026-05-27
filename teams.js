// All 48 teams — FIFA World Cup 2026
// `code` = ISO 3166-1 alpha-2 used by flagcdn.com
const TEAMS = [
  // Group A
  { id:"usa",         code:"us",     names:{ en:"United States", pt:"Estados Unidos", es:"Estados Unidos", fr:"États-Unis", de:"USA", ar:"الولايات المتحدة", ja:"アメリカ", zh:"美国" }, group:"A" },
  { id:"canada",      code:"ca",     names:{ en:"Canada", pt:"Canadá", es:"Canadá", fr:"Canada", de:"Kanada", ar:"كندا", ja:"カナダ", zh:"加拿大" }, group:"A" },
  { id:"mexico",      code:"mx",     names:{ en:"Mexico", pt:"México", es:"México", fr:"Mexique", de:"Mexiko", ar:"المكسيك", ja:"メキシコ", zh:"墨西哥" }, group:"A" },
  { id:"nzl",         code:"nz",     names:{ en:"New Zealand", pt:"Nova Zelândia", es:"Nueva Zelanda", fr:"Nouvelle-Zélande", de:"Neuseeland", ar:"نيوزيلندا", ja:"ニュージーランド", zh:"新西兰" }, group:"A" },

  // Group B
  { id:"argentina",   code:"ar",     names:{ en:"Argentina", pt:"Argentina", es:"Argentina", fr:"Argentine", de:"Argentinien", ar:"الأرجنتين", ja:"アルゼンチン", zh:"阿根廷" }, group:"B" },
  { id:"ecuador",     code:"ec",     names:{ en:"Ecuador", pt:"Equador", es:"Ecuador", fr:"Équateur", de:"Ecuador", ar:"الإكوادور", ja:"エクアドル", zh:"厄瓜多尔" }, group:"B" },
  { id:"chile",       code:"cl",     names:{ en:"Chile", pt:"Chile", es:"Chile", fr:"Chili", de:"Chile", ar:"تشيلي", ja:"チリ", zh:"智利" }, group:"B" },
  { id:"bolivia",     code:"bo",     names:{ en:"Bolivia", pt:"Bolívia", es:"Bolivia", fr:"Bolivie", de:"Bolivien", ar:"بوليفيا", ja:"ボリビア", zh:"玻利维亚" }, group:"B" },

  // Group C
  { id:"brazil",      code:"br",     names:{ en:"Brazil", pt:"Brasil", es:"Brasil", fr:"Brésil", de:"Brasilien", ar:"البرازيل", ja:"ブラジル", zh:"巴西" }, group:"C" },
  { id:"colombia",    code:"co",     names:{ en:"Colombia", pt:"Colômbia", es:"Colombia", fr:"Colombie", de:"Kolumbien", ar:"كولومبيا", ja:"コロンビア", zh:"哥伦比亚" }, group:"C" },
  { id:"paraguay",    code:"py",     names:{ en:"Paraguay", pt:"Paraguai", es:"Paraguay", fr:"Paraguay", de:"Paraguay", ar:"باراغواي", ja:"パラグアイ", zh:"巴拉圭" }, group:"C" },
  { id:"venezuela",   code:"ve",     names:{ en:"Venezuela", pt:"Venezuela", es:"Venezuela", fr:"Venezuela", de:"Venezuela", ar:"فنزويلا", ja:"ベネズエラ", zh:"委内瑞拉" }, group:"C" },

  // Group D
  { id:"france",      code:"fr",     names:{ en:"France", pt:"França", es:"Francia", fr:"France", de:"Frankreich", ar:"فرنسا", ja:"フランス", zh:"法国" }, group:"D" },
  { id:"germany",     code:"de",     names:{ en:"Germany", pt:"Alemanha", es:"Alemania", fr:"Allemagne", de:"Deutschland", ar:"ألمانيا", ja:"ドイツ", zh:"德国" }, group:"D" },
  { id:"belgium",     code:"be",     names:{ en:"Belgium", pt:"Bélgica", es:"Bélgica", fr:"Belgique", de:"Belgien", ar:"بلجيكا", ja:"ベルギー", zh:"比利时" }, group:"D" },
  { id:"wales",       code:"gb-wls", names:{ en:"Wales", pt:"País de Gales", es:"Gales", fr:"Pays de Galles", de:"Wales", ar:"ويلز", ja:"ウェールズ", zh:"威尔士" }, group:"D" },

  // Group E
  { id:"spain",       code:"es",     names:{ en:"Spain", pt:"Espanha", es:"España", fr:"Espagne", de:"Spanien", ar:"إسبانيا", ja:"スペイン", zh:"西班牙" }, group:"E" },
  { id:"portugal",    code:"pt",     names:{ en:"Portugal", pt:"Portugal", es:"Portugal", fr:"Portugal", de:"Portugal", ar:"البرتغال", ja:"ポルトガル", zh:"葡萄牙" }, group:"E" },
  { id:"turkey",      code:"tr",     names:{ en:"Turkey", pt:"Turquia", es:"Turquía", fr:"Turquie", de:"Türkei", ar:"تركيا", ja:"トルコ", zh:"土耳其" }, group:"E" },
  { id:"georgia",     code:"ge",     names:{ en:"Georgia", pt:"Geórgia", es:"Georgia", fr:"Géorgie", de:"Georgien", ar:"جورجيا", ja:"ジョージア", zh:"格鲁吉亚" }, group:"E" },

  // Group F
  { id:"england",     code:"gb-eng", names:{ en:"England", pt:"Inglaterra", es:"Inglaterra", fr:"Angleterre", de:"England", ar:"إنجلترا", ja:"イングランド", zh:"英格兰" }, group:"F" },
  { id:"netherlands", code:"nl",     names:{ en:"Netherlands", pt:"Holanda", es:"Países Bajos", fr:"Pays-Bas", de:"Niederlande", ar:"هولندا", ja:"オランダ", zh:"荷兰" }, group:"F" },
  { id:"austria",     code:"at",     names:{ en:"Austria", pt:"Áustria", es:"Austria", fr:"Autriche", de:"Österreich", ar:"النمسا", ja:"オーストリア", zh:"奥地利" }, group:"F" },
  { id:"ukraine",     code:"ua",     names:{ en:"Ukraine", pt:"Ucrânia", es:"Ucrania", fr:"Ukraine", de:"Ukraine", ar:"أوكرانيا", ja:"ウクライナ", zh:"乌克兰" }, group:"F" },

  // Group G
  { id:"italy",       code:"it",     names:{ en:"Italy", pt:"Itália", es:"Italia", fr:"Italie", de:"Italien", ar:"إيطاليا", ja:"イタリア", zh:"意大利" }, group:"G" },
  { id:"denmark",     code:"dk",     names:{ en:"Denmark", pt:"Dinamarca", es:"Dinamarca", fr:"Danemark", de:"Dänemark", ar:"الدنمارك", ja:"デンマーク", zh:"丹麦" }, group:"G" },
  { id:"serbia",      code:"rs",     names:{ en:"Serbia", pt:"Sérvia", es:"Serbia", fr:"Serbie", de:"Serbien", ar:"صربيا", ja:"セルビア", zh:"塞尔维亚" }, group:"G" },
  { id:"albania",     code:"al",     names:{ en:"Albania", pt:"Albânia", es:"Albania", fr:"Albanie", de:"Albanien", ar:"ألبانيا", ja:"アルバニア", zh:"阿尔巴尼亚" }, group:"G" },

  // Group H
  { id:"croatia",     code:"hr",     names:{ en:"Croatia", pt:"Croácia", es:"Croacia", fr:"Croatie", de:"Kroatien", ar:"كرواتيا", ja:"クロアチア", zh:"克罗地亚" }, group:"H" },
  { id:"switzerland", code:"ch",     names:{ en:"Switzerland", pt:"Suíça", es:"Suiza", fr:"Suisse", de:"Schweiz", ar:"سويسرا", ja:"スイス", zh:"瑞士" }, group:"H" },
  { id:"slovakia",    code:"sk",     names:{ en:"Slovakia", pt:"Eslováquia", es:"Eslovaquia", fr:"Slovaquie", de:"Slowakei", ar:"سلوفاكيا", ja:"スロバキア", zh:"斯洛伐克" }, group:"H" },
  { id:"czechia",     code:"cz",     names:{ en:"Czech Republic", pt:"República Tcheca", es:"República Checa", fr:"Rép. tchèque", de:"Tschechien", ar:"التشيك", ja:"チェコ", zh:"捷克" }, group:"H" },

  // Group I
  { id:"morocco",     code:"ma",     names:{ en:"Morocco", pt:"Marrocos", es:"Marruecos", fr:"Maroc", de:"Marokko", ar:"المغرب", ja:"モロッコ", zh:"摩洛哥" }, group:"I" },
  { id:"senegal",     code:"sn",     names:{ en:"Senegal", pt:"Senegal", es:"Senegal", fr:"Sénégal", de:"Senegal", ar:"السنغال", ja:"セネガル", zh:"塞内加尔" }, group:"I" },
  { id:"egypt",       code:"eg",     names:{ en:"Egypt", pt:"Egito", es:"Egipto", fr:"Égypte", de:"Ägypten", ar:"مصر", ja:"エジプト", zh:"埃及" }, group:"I" },
  { id:"southafrica", code:"za",     names:{ en:"South Africa", pt:"África do Sul", es:"Sudáfrica", fr:"Afrique du Sud", de:"Südafrika", ar:"جنوب أفريقيا", ja:"南アフリカ", zh:"南非" }, group:"I" },

  // Group J
  { id:"nigeria",     code:"ng",     names:{ en:"Nigeria", pt:"Nigéria", es:"Nigeria", fr:"Nigéria", de:"Nigeria", ar:"نيجيريا", ja:"ナイジェリア", zh:"尼日利亚" }, group:"J" },
  { id:"ghana",       code:"gh",     names:{ en:"Ghana", pt:"Gana", es:"Ghana", fr:"Ghana", de:"Ghana", ar:"غانا", ja:"ガーナ", zh:"加纳" }, group:"J" },
  { id:"cameroon",    code:"cm",     names:{ en:"Cameroon", pt:"Camarões", es:"Camerún", fr:"Cameroun", de:"Kamerun", ar:"الكاميرون", ja:"カメルーン", zh:"喀麦隆" }, group:"J" },
  { id:"cotedivoire", code:"ci",     names:{ en:"Côte d'Ivoire", pt:"Costa do Marfim", es:"Costa de Marfil", fr:"Côte d'Ivoire", de:"Elfenbeinküste", ar:"ساحل العاج", ja:"コートジボワール", zh:"科特迪瓦" }, group:"J" },

  // Group K
  { id:"japan",       code:"jp",     names:{ en:"Japan", pt:"Japão", es:"Japón", fr:"Japon", de:"Japan", ar:"اليابان", ja:"日本", zh:"日本" }, group:"K" },
  { id:"southkorea",  code:"kr",     names:{ en:"South Korea", pt:"Coreia do Sul", es:"Corea del Sur", fr:"Corée du Sud", de:"Südkorea", ar:"كوريا الجنوبية", ja:"韓国", zh:"韩国" }, group:"K" },
  { id:"australia",   code:"au",     names:{ en:"Australia", pt:"Austrália", es:"Australia", fr:"Australie", de:"Australien", ar:"أستراليا", ja:"オーストラリア", zh:"澳大利亚" }, group:"K" },
  { id:"indonesia",   code:"id",     names:{ en:"Indonesia", pt:"Indonésia", es:"Indonesia", fr:"Indonésie", de:"Indonesien", ar:"إندونيسيا", ja:"インドネシア", zh:"印度尼西亚" }, group:"K" },

  // Group L
  { id:"iran",        code:"ir",     names:{ en:"Iran", pt:"Irã", es:"Irán", fr:"Iran", de:"Iran", ar:"إيران", ja:"イラン", zh:"伊朗" }, group:"L" },
  { id:"saudiarabia", code:"sa",     names:{ en:"Saudi Arabia", pt:"Arábia Saudita", es:"Arabia Saudita", fr:"Arabie saoudite", de:"Saudi-Arabien", ar:"السعودية", ja:"サウジアラビア", zh:"沙特阿拉伯" }, group:"L" },
  { id:"iraq",        code:"iq",     names:{ en:"Iraq", pt:"Iraque", es:"Irak", fr:"Irak", de:"Irak", ar:"العراق", ja:"イラク", zh:"伊拉克" }, group:"L" },
  { id:"uae",         code:"ae",     names:{ en:"UAE", pt:"Emirados Árabes", es:"Emiratos Árabes", fr:"Émirats arabes", de:"VAE", ar:"الإمارات", ja:"UAE", zh:"阿联酋" }, group:"L" },
];

const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

function flagUrl(id) {
  const team = TEAMS.find(t => t.id === id);
  return team ? `https://flagcdn.com/w40/${team.code}.png` : "";
}
