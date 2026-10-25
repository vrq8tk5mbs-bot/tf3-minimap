"use strict";
// Interface strings for the 13 languages Transport Fever 3 ships with. English is the default.
// Town, industry, line and station names come from the game in the game's own language.

const LANGS = {
  en: "English", de: "Deutsch", fr: "Français", "zh-CN": "简体中文", "zh-TW": "繁體中文", "es-ES": "Español",
  "pt-BR": "Português (Brasil)", pl: "Polski", ja: "日本語", ko: "한국어", ru: "Русский", nl: "Nederlands", it: "Italiano",
};

// Column order of every row below.
const LANG_ORDER = ["en", "de", "fr", "zh-CN", "zh-TW", "es-ES", "pt-BR", "pl", "ja", "ko", "ru", "nl", "it"];

const STRINGS_TABLE = {
  "status.noLink":   ["No connection to computer", "Keine Verbindung zum Computer", "Pas de connexion à l'ordinateur", "未连接到电脑", "未連線到電腦", "Sin conexión con el ordenador", "Sem conexão com o computador", "Brak połączenia z komputerem", "コンピューターに接続されていません", "컴퓨터에 연결되지 않음", "Нет связи с компьютером", "Geen verbinding met de computer", "Nessuna connessione al computer"],
  "status.game":     ["Game", "Spiel", "Jeu", "游戏", "遊戲", "Juego", "Jogo", "Gra", "ゲーム", "게임", "Игра", "Spel", "Gioco"],
  "status.silent":   ["Game is silent", "Spiel antwortet nicht", "Le jeu ne répond pas", "游戏无响应", "遊戲無回應", "El juego no responde", "O jogo não responde", "Gra nie odpowiada", "ゲームの応答なし", "게임 응답 없음", "Игра молчит", "Spel reageert niet", "Il gioco non risponde"],
  "hint.silent":     ["No data from the game. Load a save and check that Minimap Companion is enabled in that save's mod list.", "Keine Daten vom Spiel. Lade einen Spielstand und prüfe, ob Minimap Companion in seiner Modliste aktiviert ist.", "Aucune donnée du jeu. Chargez une partie et vérifiez que Minimap Companion est activé dans la liste des mods de cette partie.", "没有收到游戏数据。请载入存档，并确认该存档的模组列表中已启用 Minimap Companion。", "沒有收到遊戲資料。請載入存檔，並確認該存檔的模組清單中已啟用 Minimap Companion。", "No llegan datos del juego. Carga una partida y comprueba que Minimap Companion está activado en la lista de mods de esa partida.", "Nenhum dado do jogo. Carregue um jogo salvo e confira se o Minimap Companion está ativo na lista de mods desse jogo.", "Brak danych z gry. Wczytaj zapis i sprawdź, czy Minimap Companion jest włączony na liście modów tego zapisu.", "ゲームからデータが届いていません。セーブを読み込み、そのセーブの MOD 一覧で Minimap Companion が有効か確認してください。", "게임에서 데이터가 오지 않습니다. 세이브를 불러오고 그 세이브의 모드 목록에서 Minimap Companion이 켜져 있는지 확인하세요.", "От игры нет данных. Загрузи сейв и проверь, что в списке модов этого сейва включён Minimap Companion.", "Geen gegevens van het spel. Laad een savegame en controleer of Minimap Companion aanstaat in de modlijst van die savegame.", "Nessun dato dal gioco. Carica un salvataggio e controlla che Minimap Companion sia attiva nell'elenco mod di quel salvataggio."],
  "hint.noLink":     ["Can't reach the companion. Start it on your computer; this device must be on the same Wi-Fi.", "Companion nicht erreichbar. Starte ihn auf dem Computer; dieses Gerät muss im selben WLAN sein.", "Le compagnon est injoignable. Lancez-le sur l'ordinateur ; cet appareil doit être sur le même Wi-Fi.", "无法连接到 companion。请在电脑上启动它；本设备须连接同一 Wi-Fi。", "無法連線到 companion。請在電腦上啟動它；本裝置須連接同一個 Wi-Fi。", "No se puede contactar con el companion. Ábrelo en el ordenador; este dispositivo debe estar en la misma Wi-Fi.", "Não foi possível alcançar o companion. Abra-o no computador; este aparelho precisa estar no mesmo Wi-Fi.", "Brak kontaktu z companionem. Uruchom go na komputerze; to urządzenie musi być w tej samej sieci Wi-Fi.", "companion に接続できません。コンピューターで起動し、この端末を同じ Wi-Fi に接続してください。", "companion에 연결할 수 없습니다. 컴퓨터에서 실행하고 이 기기를 같은 Wi-Fi에 연결하세요.", "Компаньон недоступен. Запусти его на компьютере; это устройство должно быть в той же Wi-Fi.", "Companion niet bereikbaar. Start hem op de computer; dit apparaat moet op hetzelfde wifi-netwerk zitten.", "Companion non raggiungibile. Avvialo sul computer; questo dispositivo deve essere sulla stessa rete Wi-Fi."],
  "search":          ["Town, industry, station, line", "Stadt, Industrie, Bahnhof, Linie", "Ville, industrie, gare, ligne", "城镇、工业、车站、线路", "城鎮、工業、車站、路線", "Ciudad, industria, estación, línea", "Cidade, indústria, estação, linha", "Miasto, przemysł, stacja, linia", "町・産業・駅・路線", "도시, 산업, 역, 노선", "Город, производство, станция, линия", "Stad, industrie, station, lijn", "Città, industria, stazione, linea"],
  "empty.title":     ["Waiting for the game", "Warte auf das Spiel", "En attente du jeu", "等待游戏数据", "等待遊戲資料", "Esperando al juego", "Aguardando o jogo", "Czekam na grę", "ゲームを待っています", "게임을 기다리는 중", "Жду данные от игры", "Wachten op het spel", "In attesa del gioco"],
  "empty.body":      ["Load a save with the Minimap Companion mod enabled.", "Lade einen Spielstand mit aktivem Mod Minimap Companion.", "Chargez une partie avec le mod Minimap Companion activé.", "请载入启用了 Minimap Companion 模组的存档。", "請載入啟用 Minimap Companion 模組的存檔。", "Carga una partida con el mod Minimap Companion activado.", "Carregue um jogo salvo com o mod Minimap Companion ativo.", "Wczytaj zapis z włączonym modem Minimap Companion.", "Minimap Companion を有効にしたセーブを読み込んでください。", "Minimap Companion 모드를 켠 세이브를 불러오세요.", "Загрузи сейв с активным модом Minimap Companion.", "Laad een savegame met de mod Minimap Companion actief.", "Carica un salvataggio con la mod Minimap Companion attiva."],

  "layer.rail":      ["Rail", "Schiene", "Rail", "铁路", "鐵路", "Vías", "Trilhos", "Tory", "線路", "철도", "Ж/д", "Spoor", "Binari"],
  "layer.street":    ["Roads", "Straßen", "Routes", "道路", "道路", "Carreteras", "Estradas", "Drogi", "道路", "도로", "Дороги", "Wegen", "Strade"],
  "layer.lines":     ["Lines", "Linien", "Lignes", "线路", "路線", "Líneas", "Linhas", "Linie", "路線", "노선", "Линии", "Lijnen", "Linee"],
  "layer.stations":  ["Stations", "Stationen", "Gares", "车站", "車站", "Estaciones", "Estações", "Stacje", "駅", "역", "Станции", "Stations", "Stazioni"],
  "layer.catchment": ["Catchment", "Einzugsgebiet", "Zone desservie", "服务范围", "服務範圍", "Área de servicio", "Área de cobertura", "Zasięg", "利用圏", "서비스 범위", "Зона охвата", "Verzorgingsgebied", "Bacino d'utenza"],
  "layer.vehicles":  ["Vehicles", "Fahrzeuge", "Véhicules", "车辆", "車輛", "Vehículos", "Veículos", "Pojazdy", "車両", "차량", "Транспорт", "Voertuigen", "Veicoli"],
  "layer.towns":     ["Towns", "Städte", "Villes", "城镇", "城鎮", "Ciudades", "Cidades", "Miasta", "町", "도시", "Города", "Steden", "Città"],
  "layer.industries":["Industries", "Industrien", "Industries", "工业", "工業", "Industrias", "Indústrias", "Przemysł", "産業", "산업", "Производства", "Industrieën", "Industrie"],
  "layer.terrain":   ["Terrain", "Gelände", "Relief", "地形", "地形", "Relieve", "Relevo", "Teren", "地形", "지형", "Рельеф", "Terrein", "Rilievo"],
  "layer.biomes":    ["Biomes", "Biome", "Biomes", "生物群系", "生物群系", "Biomas", "Biomas", "Biomy", "バイオーム", "생물 군계", "Биомы", "Biomen", "Biomi"],
  "layer.noise":     ["Noise", "Lärm", "Bruit", "噪音", "噪音", "Ruido", "Ruído", "Hałas", "騒音", "소음", "Шум", "Geluid", "Rumore"],
  "layer.pollution": ["Pollution", "Verschmutzung", "Pollution", "污染", "汙染", "Contaminación", "Poluição", "Zanieczyszczenie", "汚染", "오염", "Загрязнение", "Vervuiling", "Inquinamento"],

  "mode.train":      ["Train", "Zug", "Train", "火车", "火車", "Tren", "Trem", "Pociąg", "列車", "기차", "Поезд", "Trein", "Treno"],
  "mode.tram":       ["Tram", "Straßenbahn", "Tramway", "有轨电车", "路面電車", "Tranvía", "Bonde", "Tramwaj", "路面電車", "트램", "Трамвай", "Tram", "Tram"],
  "mode.bus":        ["Bus", "Bus", "Bus", "公交车", "公車", "Autobús", "Ônibus", "Autobus", "バス", "버스", "Автобус", "Bus", "Autobus"],
  "mode.truck":      ["Truck", "Lkw", "Camion", "卡车", "卡車", "Camión", "Caminhão", "Ciężarówka", "トラック", "트럭", "Грузовик", "Vrachtwagen", "Camion"],
  "mode.plane":      ["Aircraft", "Flugzeug", "Avion", "飞机", "飛機", "Avión", "Avião", "Samolot", "飛行機", "비행기", "Самолёт", "Vliegtuig", "Aereo"],
  "mode.heli":       ["Helicopter", "Hubschrauber", "Hélicoptère", "直升机", "直升機", "Helicóptero", "Helicóptero", "Śmigłowiec", "ヘリコプター", "헬리콥터", "Вертолёт", "Helikopter", "Elicottero"],
  "mode.ship":       ["Ship", "Schiff", "Navire", "船舶", "船舶", "Barco", "Navio", "Statek", "船", "선박", "Корабль", "Schip", "Nave"],
  "pass":            ["Passengers", "Passagiere", "Passagers", "乘客", "乘客", "Pasajeros", "Passageiros", "Pasażerowie", "旅客", "승객", "Пассажиры", "Passagiers", "Passeggeri"],
  "cargo":           ["Cargo", "Fracht", "Fret", "货物", "貨物", "Carga", "Carga", "Ładunek", "貨物", "화물", "Груз", "Vracht", "Merci"],

  "set.title":       ["Settings", "Einstellungen", "Réglages", "设置", "設定", "Ajustes", "Configurações", "Ustawienia", "設定", "설정", "Настройки", "Instellingen", "Impostazioni"],
  "set.language":    ["Language", "Sprache", "Langue", "语言", "語言", "Idioma", "Idioma", "Język", "言語", "언어", "Язык", "Taal", "Lingua"],
  "set.layers":      ["Layers", "Ebenen", "Calques", "图层", "圖層", "Capas", "Camadas", "Warstwy", "レイヤー", "레이어", "Слои", "Lagen", "Livelli"],
  "set.lines":       ["Line filter", "Linienfilter", "Filtre des lignes", "线路筛选", "路線篩選", "Filtro de líneas", "Filtro de linhas", "Filtr linii", "路線フィルター", "노선 필터", "Фильтр линий", "Lijnfilter", "Filtro linee"],
  "set.towns":       ["Towns", "Städte", "Villes", "城镇", "城鎮", "Ciudades", "Cidades", "Miasta", "町", "도시", "Города", "Steden", "Città"],
  "set.industries":  ["Industry types", "Industrietypen", "Types d'industrie", "工业类型", "工業類型", "Tipos de industria", "Tipos de indústria", "Rodzaje przemysłu", "産業の種類", "산업 유형", "Типы производств", "Industrietypen", "Tipi di industria"],
  "set.chain":       ["Chain", "Kette", "Chaîne", "产业链", "產業鏈", "Cadena", "Cadeia", "Łańcuch", "チェーン", "체인", "Цепочка", "Keten", "Catena"],
  "set.chainHint":   ["“Chain” shows only that type plus the types that supply it or take its cargo. “All” brings everything back.", "„Kette“ zeigt nur diesen Typ und die Typen, die ihn beliefern oder seine Fracht abnehmen. „Alle“ zeigt wieder alles.", "« Chaîne » n'affiche que ce type et les types qui le fournissent ou prennent sa cargaison. « Tout » réaffiche tout.", "“产业链”只显示该类型及为其供货或接收其货物的类型。“全部”恢复显示所有。", "「產業鏈」只顯示該類型及為其供貨或接收其貨物的類型。「全部」恢復顯示所有。", "«Cadena» muestra solo ese tipo y los tipos que lo abastecen o reciben su carga. «Todo» vuelve a mostrarlo todo.", "“Cadeia” mostra só esse tipo e os tipos que o abastecem ou recebem sua carga. “Tudo” mostra tudo de novo.", "„Łańcuch” pokazuje tylko ten rodzaj oraz rodzaje, które go zaopatrują lub odbierają jego ładunek. „Wszystkie” przywraca resztę.", "「チェーン」はその種類と、それに供給する種類・その貨物を受け取る種類だけを表示します。「すべて」で元に戻ります。", "‘체인’은 해당 유형과 그 유형에 공급하거나 화물을 받는 유형만 표시합니다. ‘전체’로 모두 다시 표시합니다.", "«Цепочка» оставляет только этот тип и тех, кто его снабжает или принимает его груз. «Все» возвращает всё.", "„Keten” toont alleen dit type plus de types die het bevoorraden of de vracht afnemen. „Alles” toont weer alles.", "«Catena» mostra solo quel tipo e i tipi che lo riforniscono o ne ricevono il carico. «Tutto» ripristina tutto."],
  "set.export":      ["Export", "Export", "Export", "导出", "匯出", "Exportar", "Exportar", "Eksport", "書き出し", "내보내기", "Экспорт", "Exporteren", "Esporta"],
  "set.pinHint":     ["★ adds a layer to the quick bar", "★ legt die Ebene in die Schnellleiste", "★ ajoute le calque à la barre rapide", "★ 把图层加入快捷栏", "★ 把圖層加入快捷列", "★ añade la capa a la barra rápida", "★ adiciona a camada à barra rápida", "★ dodaje warstwę do szybkiego paska", "★ でクイックバーに追加", "★ 빠른 막대에 추가", "★ — показывать слой на быстрой панели", "★ zet de laag in de snelbalk", "★ aggiunge il livello alla barra rapida"],
  "set.showPop":     ["Show population", "Einwohner anzeigen", "Afficher la population", "显示人口", "顯示人口", "Mostrar población", "Mostrar população", "Pokaż ludność", "人口を表示", "인구 표시", "Показывать жителей", "Inwoners tonen", "Mostra popolazione"],
  "set.showNeeds":   ["Show town needs", "Bedarf der Städte anzeigen", "Afficher les besoins", "显示城镇需求", "顯示城鎮需求", "Mostrar demandas", "Mostrar demandas", "Pokaż potrzeby miast", "町の需要を表示", "도시 수요 표시", "Показывать, что хотят города", "Behoeften tonen", "Mostra richieste"],
  "set.all":         ["All", "Alle", "Tout", "全部", "全部", "Todo", "Tudo", "Wszystkie", "すべて", "전체", "Все", "Alles", "Tutto"],
  "set.none":        ["None", "Keine", "Aucun", "无", "無", "Nada", "Nada", "Żadne", "なし", "없음", "Ничего", "Geen", "Niente"],
  "set.close":       ["Done", "Fertig", "OK", "完成", "完成", "Listo", "Pronto", "Gotowe", "完了", "완료", "Готово", "Klaar", "Fatto"],

  "exp.geo":         ["Line map (SVG)", "Linienkarte (SVG)", "Carte des lignes (SVG)", "线路图 (SVG)", "路線圖 (SVG)", "Mapa de líneas (SVG)", "Mapa de linhas (SVG)", "Mapa linii (SVG)", "路線図 (SVG)", "노선도 (SVG)", "Карта линий (SVG)", "Lijnenkaart (SVG)", "Mappa linee (SVG)"],
  "exp.metro":       ["Metro-style scheme (SVG)", "Schema im U-Bahn-Stil (SVG)", "Schéma style métro (SVG)", "地铁风格示意图 (SVG)", "地鐵風格示意圖 (SVG)", "Esquema estilo metro (SVG)", "Esquema estilo metrô (SVG)", "Schemat w stylu metra (SVG)", "地下鉄風の路線図 (SVG)", "지하철 노선도 스타일 (SVG)", "Схема как у метро (SVG)", "Metroschema (SVG)", "Schema stile metro (SVG)"],
  "exp.title":       ["Transport network", "Verkehrsnetz", "Réseau de transport", "交通网络", "交通網路", "Red de transporte", "Rede de transporte", "Sieć transportowa", "交通網", "교통망", "Транспортная сеть", "Vervoersnet", "Rete di trasporto"],
  "set.resetAll":    ["Reset all filters", "Alle Filter zurücksetzen", "Réinitialiser tous les filtres", "重置所有筛选", "重設所有篩選", "Restablecer todos los filtros", "Redefinir todos os filtros", "Resetuj wszystkie filtry", "すべてのフィルターをリセット", "모든 필터 초기화", "Сбросить все фильтры", "Alle filters resetten", "Reimposta tutti i filtri"],
  "set.resetHint":   ["Layers, line filter and industry types back to defaults", "Ebenen, Linienfilter und Industrietypen auf Standard", "Calques, filtre des lignes et types d'industrie par défaut", "图层、线路筛选和工业类型恢复默认", "圖層、路線篩選和工業類型恢復預設", "Capas, filtro de líneas y tipos de industria por defecto", "Camadas, filtro de linhas e tipos de indústria no padrão", "Warstwy, filtr linii i rodzaje przemysłu domyślnie", "レイヤー・路線フィルター・産業の種類を初期状態に", "레이어, 노선 필터, 산업 유형을 기본값으로", "Слои, фильтр линий и типы производств — как по умолчанию", "Lagen, lijnfilter en industrietypen terug naar standaard", "Livelli, filtro linee e tipi di industria predefiniti"],
  "set.reset":       ["Reset", "Zurücksetzen", "Réinitialiser", "重置", "重設", "Restablecer", "Redefinir", "Resetuj", "リセット", "초기화", "Сбросить", "Resetten", "Reimposta"],
  "set.default":     ["Default", "Standard", "Par défaut", "默认", "預設", "Por defecto", "Padrão", "Domyślne", "初期設定", "기본값", "По умолчанию", "Standaard", "Predefiniti"],
  "set.filtersOn":   ["Filters on", "Filter aktiv", "Filtres actifs", "筛选已启用", "篩選已啟用", "Filtros activos", "Filtros ativos", "Filtry włączone", "フィルター適用中", "필터 적용 중", "Есть фильтры", "Filters actief", "Filtri attivi"],
  "toast.reset":     ["Filters reset", "Filter zurückgesetzt", "Filtres réinitialisés", "筛选已重置", "篩選已重設", "Filtros restablecidos", "Filtros redefinidos", "Filtry zresetowane", "フィルターをリセットしました", "필터를 초기화했습니다", "Фильтры сброшены", "Filters gereset", "Filtri reimpostati"],
  "toast.chain":     ["Showing: {kinds}", "Angezeigt: {kinds}", "Affiché : {kinds}", "显示：{kinds}", "顯示：{kinds}", "Mostrando: {kinds}", "Mostrando: {kinds}", "Widoczne: {kinds}", "表示中：{kinds}", "표시 중: {kinds}", "Показаны: {kinds}", "Getoond: {kinds}", "Mostrati: {kinds}"],
  "set.map":         ["Map", "Karte", "Carte", "地图", "地圖", "Mapa", "Mapa", "Mapa", "地図", "지도", "Карта", "Kaart", "Mappa"],
  "set.mapStyle":    ["Map style", "Kartenstil", "Style de carte", "地图样式", "地圖樣式", "Estilo del mapa", "Estilo do mapa", "Styl mapy", "地図のスタイル", "지도 스타일", "Стиль карты", "Kaartstijl", "Stile mappa"],
  "style.natural":   ["Natural", "Natürlich", "Naturel", "自然", "自然", "Natural", "Natural", "Naturalny", "ナチュラル", "자연", "Природный", "Natuurlijk", "Naturale"],
  "style.dark":      ["Dark", "Dunkel", "Sombre", "深色", "深色", "Oscuro", "Escuro", "Ciemny", "ダーク", "어둡게", "Тёмный", "Donker", "Scuro"],
  "set.lineTags":    ["Line names on the map", "Liniennamen auf der Karte", "Noms des lignes sur la carte", "在地图上显示线路名称", "在地圖上顯示路線名稱", "Nombres de líneas en el mapa", "Nomes das linhas no mapa", "Nazwy linii na mapie", "地図に路線名を表示", "지도에 노선 이름 표시", "Названия линий на карте", "Lijnnamen op de kaart", "Nomi delle linee sulla mappa"],
  "card.carrying":   ["Carrying now", "Transportiert gerade", "Transporte actuellement", "当前运输", "目前運輸", "Transporta ahora", "Transportando agora", "Przewozi teraz", "現在の積荷", "현재 운송 중", "Сейчас везёт", "Vervoert nu", "Trasporta ora"],
  "card.emptyNow":   ["Empty right now", "Gerade leer", "Vide en ce moment", "当前空载", "目前空載", "Vacío ahora", "Vazio agora", "Teraz pusto", "現在は空", "현재 비어 있음", "Сейчас пусто", "Nu leeg", "Vuoto ora"],
  "card.canCarry":   ["Can also carry", "Kann auch laden", "Peut aussi transporter", "还可运输", "還可運輸", "También puede llevar", "Também pode levar", "Może też przewozić", "他に積める貨物", "추가로 운송 가능", "Может везти ещё", "Kan ook vervoeren", "Può trasportare anche"],
  "hint.tapLine":    ["Tap a line or its name tag to see its stats", "Tippe auf eine Linie oder ihr Namensschild für Details", "Touchez une ligne ou son étiquette pour voir ses statistiques", "点按线路或其名称标签查看统计", "點按路線或其名稱標籤查看統計", "Toca una línea o su etiqueta para ver sus datos", "Toque em uma linha ou na etiqueta para ver os dados", "Dotknij linii lub jej etykiety, aby zobaczyć statystyki", "路線か名前ラベルをタップすると詳細を表示", "노선이나 이름표를 탭하면 통계를 볼 수 있어요", "Нажми на линию или её табличку — откроется статистика", "Tik op een lijn of het naamlabel voor details", "Tocca una linea o la sua etichetta per i dettagli"],
  "exp.unlabeled":   ["Stations without a label on the map", "Stationen ohne Beschriftung auf der Karte", "Gares sans étiquette sur la carte", "图上未标注的车站", "圖上未標註的車站", "Estaciones sin etiqueta en el mapa", "Estações sem rótulo no mapa", "Stacje bez podpisu na mapie", "地図上で名前を省略した駅", "지도에 이름이 생략된 역", "Станции без подписи на схеме", "Stations zonder label op de kaart", "Stazioni senza etichetta sulla mappa"],
  "set.rotation":     ["Map rotation", "Kartendrehung", "Rotation de la carte", "地图旋转", "地圖旋轉", "Rotación del mapa", "Rotação do mapa", "Obrót mapy", "地図の回転", "지도 회전", "Поворот карты", "Kaartrotatie", "Rotazione mappa"],
  "set.rotationHint": ["Any angle: twist with two fingers (Shift + wheel on a computer). Compass: north up", "Beliebiger Winkel: mit zwei Fingern drehen (am Computer Umschalt + Mausrad). Kompass: Norden oben", "N'importe quel angle : tournez à deux doigts (Maj + molette sur ordinateur). Boussole : nord en haut", "任意角度：双指旋转（电脑上按 Shift + 滚轮）。指南针：北方朝上", "任意角度：雙指旋轉（電腦上按 Shift + 滾輪）。指南針：北方朝上", "Cualquier ángulo: gira con dos dedos (Mayús + rueda en el ordenador). Brújula: norte arriba", "Qualquer ângulo: gire com dois dedos (Shift + roda no computador). Bússola: norte para cima", "Dowolny kąt: obróć dwoma palcami (Shift + kółko na komputerze). Kompas: północ u góry", "任意の角度：2本指で回す（PCではShift＋ホイール）。コンパス：北を上に", "원하는 각도: 두 손가락으로 돌리기 (컴퓨터는 Shift + 휠). 나침반: 북쪽 위로", "Любой угол: крути двумя пальцами (на компьютере Shift + колесо). Компас — север сверху", "Elke hoek: draai met twee vingers (Shift + scrollwiel op een computer). Kompas: noorden boven", "Qualsiasi angolo: ruota con due dita (Maiusc + rotellina sul computer). Bussola: nord in alto"],
  "rot.north":        ["North up", "Norden oben", "Nord en haut", "北方朝上", "北方朝上", "Norte arriba", "Norte para cima", "Północ u góry", "北が上", "북쪽 위", "Север сверху", "Noorden boven", "Nord in alto"],
  "rot.auto":         ["Fit to screen", "An Bildschirm anpassen", "Selon l'écran", "适应屏幕", "符合螢幕", "Según la pantalla", "Conforme a tela", "Do ekranu", "画面に合わせる", "화면에 맞춤", "Под экран", "Naar scherm", "In base allo schermo"],
  "btn.compass":      ["North up", "Norden oben", "Nord en haut", "北方朝上", "北方朝上", "Norte arriba", "Norte para cima", "Północ u góry", "北を上に", "북쪽 위로", "Север сверху", "Noorden boven", "Nord in alto"],
  "set.units":        ["Distance units", "Entfernungseinheiten", "Unités de distance", "距离单位", "距離單位", "Unidades de distancia", "Unidades de distância", "Jednostki odległości", "距離の単位", "거리 단위", "Единицы расстояния", "Afstandseenheden", "Unità di distanza"],
  "units.km":         ["Kilometres", "Kilometer", "Kilomètres", "公里", "公里", "Kilómetros", "Quilômetros", "Kilometry", "キロメートル", "킬로미터", "Километры", "Kilometers", "Chilometri"],
  "units.mi":         ["Miles", "Meilen", "Miles", "英里", "英里", "Millas", "Milhas", "Mile", "マイル", "마일", "Мили", "Mijlen", "Miglia"],

  "btn.follow":      ["Follow camera", "Kamera folgen", "Suivre la caméra", "跟随镜头", "跟隨鏡頭", "Seguir la cámara", "Seguir a câmera", "Śledź kamerę", "カメラを追従", "카메라 따라가기", "Следовать за камерой", "Camera volgen", "Segui la telecamera"],
  "btn.fit":         ["Whole map", "Ganze Karte", "Carte entière", "整张地图", "整張地圖", "Mapa completo", "Mapa inteiro", "Cała mapa", "全体", "전체 지도", "Вся карта", "Hele kaart", "Mappa intera"],
  "btn.fitWidth":    ["Fill width", "Breite füllen", "Remplir la largeur", "填满宽度", "填滿寬度", "Ajustar al ancho", "Preencher a largura", "Wypełnij szerokość", "幅に合わせる", "너비 맞춤", "По ширине", "Breedte vullen", "Riempi larghezza"],
  "btn.settings":    ["Settings", "Einstellungen", "Réglages", "设置", "設定", "Ajustes", "Configurações", "Ustawienia", "設定", "설정", "Настройки", "Instellingen", "Impostazioni"],
  "btn.showInGame":  ["Show in game", "Im Spiel zeigen", "Voir dans le jeu", "在游戏中查看", "在遊戲中查看", "Ver en el juego", "Ver no jogo", "Pokaż w grze", "ゲームで表示", "게임에서 보기", "Показать в игре", "Toon in spel", "Mostra nel gioco"],
  "btn.chain":       ["Only this chain", "Nur diese Kette", "Seulement cette chaîne", "仅此产业链", "僅此產業鏈", "Solo esta cadena", "Só esta cadeia", "Tylko ten łańcuch", "このチェーンのみ", "이 체인만", "Только эта цепочка", "Alleen deze keten", "Solo questa catena"],
  "btn.unchain":     ["Show all types", "Alle Typen zeigen", "Afficher tous les types", "显示所有类型", "顯示所有類型", "Mostrar todos los tipos", "Mostrar todos os tipos", "Pokaż wszystkie rodzaje", "すべての種類を表示", "모든 유형 표시", "Показать все типы", "Alle types tonen", "Mostra tutti i tipi"],
  "focus.title":     ["Focus", "Fokus", "Focus", "聚焦", "聚焦", "Enfoque", "Foco", "Skupienie", "フォーカス", "집중", "Фокус", "Focus", "Focus"],
  "focus.rail":      ["Rail", "Bahn", "Rail", "铁路", "鐵路", "Tren", "Ferrovia", "Kolej", "鉄道", "철도", "Ж/д", "Spoor", "Ferrovia"],
  "focus.road":      ["Road", "Straße", "Route", "公路", "公路", "Carretera", "Rodovia", "Drogi", "道路", "도로", "Дороги", "Weg", "Strada"],
  "focus.water":     ["Water", "Wasser", "Eau", "水运", "水運", "Agua", "Água", "Woda", "水上", "해운", "Вода", "Water", "Acqua"],
  "focus.air":       ["Air", "Luft", "Air", "航空", "航空", "Aire", "Aéreo", "Powietrze", "航空", "항공", "Воздух", "Lucht", "Aereo"],
  "btn.focusLine":   ["Only this line", "Nur diese Linie", "Seulement cette ligne", "仅此线路", "僅此路線", "Solo esta línea", "Só esta linha", "Tylko ta linia", "この路線のみ", "이 노선만", "Только эта линия", "Alleen deze lijn", "Solo questa linea"],
  "btn.focusStation":["Only this station", "Nur diese Station", "Seulement cette gare", "仅此车站", "僅此車站", "Solo esta estación", "Só esta estação", "Tylko ta stacja", "この駅のみ", "이 역만", "Только эта станция", "Alleen dit station", "Solo questa stazione"],
  "btn.unfocus":     ["Show everything", "Alles zeigen", "Tout afficher", "显示全部", "顯示全部", "Mostrar todo", "Mostrar tudo", "Pokaż wszystko", "すべて表示", "모두 표시", "Показать всё", "Alles tonen", "Mostra tutto"],
  "toast.focus":     ["Focus: {what}. ✕ shows everything again", "Fokus: {what}. ✕ zeigt wieder alles", "Focus : {what}. ✕ réaffiche tout", "聚焦：{what}。点 ✕ 显示全部", "聚焦：{what}。點 ✕ 顯示全部", "Enfoque: {what}. ✕ vuelve a mostrar todo", "Foco: {what}. ✕ mostra tudo de novo", "Skupienie: {what}. ✕ pokazuje wszystko", "フォーカス：{what}。✕ ですべて表示", "집중: {what}. ✕를 누르면 모두 표시", "Фокус: {what}. ✕ вернёт всё", "Focus: {what}. ✕ toont weer alles", "Focus: {what}. ✕ mostra di nuovo tutto"],
  "legend.oneway":   ["One-way track", "Einbahngleis", "Voie à sens unique", "单向轨道", "單向軌道", "Vía de sentido único", "Via de mão única", "Tor jednokierunkowy", "一方通行の線路", "일방향 선로", "Одностороннее движение", "Eenrichtingsspoor", "Binario a senso unico"],
  "legend.twoway":   ["Both ways", "Beide Richtungen", "Deux sens", "双向", "雙向", "Ambos sentidos", "Dois sentidos", "Oba kierunki", "双方向", "양방향", "В обе стороны", "Beide richtingen", "Doppio senso"],
  "legend.conflict": ["One-way signals facing each other", "Einbahnsignale gegeneinander", "Signaux à sens unique opposés", "单向信号方向相反", "單向號誌方向相反", "Señales de sentido único enfrentadas", "Sinais de mão única opostos", "Sygnały jednokierunkowe naprzeciw siebie", "一方通行信号が向かい合っています", "일방향 신호가 서로 마주 봄", "Односторонние сигналы навстречу друг другу", "Eenrichtingsseinen tegen elkaar in", "Segnali a senso unico contrapposti"],
  "legend.noSignals":["Signals need the updated mod (restart the game after mod.io updates it)", "Signale brauchen den aktualisierten Mod (Spiel nach dem mod.io-Update neu starten)", "Les signaux exigent le mod mis à jour (redémarrez le jeu après la mise à jour mod.io)", "信号需要更新后的模组（mod.io 更新后重启游戏）", "號誌需要更新後的模組（mod.io 更新後重新啟動遊戲）", "Las señales requieren el mod actualizado (reinicia el juego tras la actualización de mod.io)", "Os sinais exigem o mod atualizado (reinicie o jogo depois da atualização do mod.io)", "Sygnały wymagają zaktualizowanego moda (uruchom grę ponownie po aktualizacji z mod.io)", "信号の表示には更新版の MOD が必要です（mod.io で更新後にゲームを再起動）", "신호를 보려면 업데이트된 모드가 필요합니다(mod.io 업데이트 후 게임 재시작)", "Для сигналов нужен обновлённый мод (перезапусти игру после обновления с mod.io)", "Seinen vereisen de bijgewerkte mod (start het spel opnieuw na de mod.io-update)", "I segnali richiedono la mod aggiornata (riavvia il gioco dopo l'aggiornamento da mod.io)"],
  "btn.followVehicle":["Follow in game", "Im Spiel verfolgen", "Suivre dans le jeu", "在游戏中跟随", "在遊戲中跟隨", "Seguir en el juego", "Seguir no jogo", "Śledź w grze", "ゲームで追従", "게임에서 따라가기", "Следить в игре", "Volgen in spel", "Segui nel gioco"],

  "card.town":       ["Town", "Stadt", "Ville", "城镇", "城鎮", "Ciudad", "Cidade", "Miasto", "町", "도시", "Город", "Stad", "Città"],
  "card.industry":   ["Industry", "Industrie", "Industrie", "工业", "工業", "Industria", "Indústria", "Przemysł", "産業", "산업", "Производство", "Industrie", "Industria"],
  "card.station":    ["Station", "Station", "Gare", "车站", "車站", "Estación", "Estação", "Stacja", "駅", "역", "Станция", "Station", "Stazione"],
  "card.line":       ["Line", "Linie", "Ligne", "线路", "路線", "Línea", "Linha", "Linia", "路線", "노선", "Линия", "Lijn", "Linea"],
  "card.vehicle":    ["Vehicle", "Fahrzeug", "Véhicule", "车辆", "車輛", "Vehículo", "Veículo", "Pojazd", "車両", "차량", "Транспорт", "Voertuig", "Veicolo"],
  "card.population": ["Residents", "Einwohner", "Habitants", "居民", "居民", "Habitantes", "Habitantes", "Mieszkańcy", "住民", "주민", "Жители", "Inwoners", "Abitanti"],
  "card.commercial": ["Commercial", "Gewerbe", "Commerce", "商业", "商業", "Comercio", "Comércio", "Handel", "商業", "상업", "Торговля", "Commercieel", "Commercio"],
  "card.industrial": ["Industrial", "Industrie", "Industrie", "工业", "工業", "Industria", "Indústria", "Przemysł", "工業", "공업", "Промышленность", "Industrie", "Industria"],
  "card.needs":      ["Needs", "Bedarf", "Besoins", "需求", "需求", "Demanda", "Demanda", "Potrzeby", "需要", "수요", "Хотят", "Behoeften", "Richieste"],
  "card.produces":   ["Produces", "Produziert", "Produit", "生产", "生產", "Produce", "Produz", "Produkuje", "生産", "생산", "Производит", "Produceert", "Produce"],
  "card.consumes":   ["Consumes", "Verbraucht", "Consomme", "消耗", "消耗", "Consume", "Consome", "Zużywa", "消費", "소비", "Потребляет", "Verbruikt", "Consuma"],
  "card.flowsIn":    ["Delivered from", "Geliefert von", "Livré depuis", "来源", "來源", "Recibe de", "Recebe de", "Dostawy z", "供給元", "공급처", "Откуда везут", "Geleverd door", "Fornito da"],
  "card.flowsOut":   ["Delivered to", "Geliefert an", "Livré à", "去向", "去向", "Envía a", "Envia para", "Dostawy do", "供給先", "공급 대상", "Куда везут", "Geleverd aan", "Consegnato a"],
  "card.receivers":  ["Nearest receivers", "Nächste Abnehmer", "Destinataires les plus proches", "最近的接收方", "最近的接收方", "Receptores más cercanos", "Recebedores mais próximos", "Najbliżsi odbiorcy", "最寄りの受け入れ先", "가장 가까운 수요처", "Ближайшие получатели", "Dichtstbijzijnde afnemers", "Destinatari più vicini"],
  "card.suppliers":  ["Nearest suppliers", "Nächste Lieferanten", "Fournisseurs les plus proches", "最近的供应方", "最近的供應方", "Proveedores más cercanos", "Fornecedores mais próximos", "Najbliżsi dostawcy", "最寄りの供給元", "가장 가까운 공급처", "Ближайшие поставщики", "Dichtstbijzijnde leveranciers", "Fornitori più vicini"],
  "card.chainHint":  ["Straight-line distance. ✓ = already delivering.", "Luftlinie. ✓ = wird bereits beliefert.", "Distance à vol d'oiseau. ✓ = livraison déjà en cours.", "直线距离。✓ = 已在运送。", "直線距離。✓ = 已在運送。", "Distancia en línea recta. ✓ = ya se entrega.", "Distância em linha reta. ✓ = já entrega.", "Odległość w linii prostej. ✓ = dostawy już trwają.", "直線距離。✓ = すでに輸送中。", "직선 거리. ✓ = 이미 운송 중.", "Расстояние по прямой. ✓ = уже возят.", "Afstand hemelsbreed. ✓ = wordt al geleverd.", "Distanza in linea d'aria. ✓ = già consegnato."],
  "card.nonePartner":["none on the map", "keiner auf der Karte", "aucun sur la carte", "地图上没有", "地圖上沒有", "ninguno en el mapa", "nenhum no mapa", "brak na mapie", "マップ上になし", "지도에 없음", "на карте нет", "geen op de kaart", "nessuno sulla mappa"],
  "card.morePartners":["+{n} more", "+{n} weitere", "+{n} autres", "另有 {n} 个", "另有 {n} 個", "+{n} más", "+{n} outros", "+{n} więcej", "ほか {n} 件", "외 {n}개", "ещё {n}", "+{n} meer", "+{n} altri"],
  "card.lines":      ["Lines", "Linien", "Lignes", "线路", "路線", "Líneas", "Linhas", "Linie", "路線", "노선", "Линии", "Lijnen", "Linee"],
  "card.catchment":  ["In catchment", "Im Einzugsgebiet", "Dans la zone", "服务范围内", "服務範圍內", "En el área", "Na área", "W zasięgu", "利用圏内", "범위 내", "В зоне охвата", "In bereik", "Nel bacino"],
  "card.radius":     ["Catchment radius", "Einzugsradius", "Rayon desservi", "服务半径", "服務半徑", "Radio de servicio", "Raio de cobertura", "Promień zasięgu", "利用圏の半径", "서비스 반경", "Радиус охвата", "Straal", "Raggio"],
  "card.length":     ["Length", "Länge", "Longueur", "长度", "長度", "Longitud", "Comprimento", "Długość", "長さ", "길이", "Длина", "Lengte", "Lunghezza"],
  "card.lengthPath": ["along the route", "entlang der Strecke", "par l'itinéraire", "沿实际路线", "沿實際路線", "por el recorrido", "pelo trajeto", "po trasie", "経路に沿って", "경로 기준", "по путям", "langs de route", "lungo il percorso"],
  "card.lengthStraight":["straight line", "Luftlinie", "à vol d'oiseau", "直线距离", "直線距離", "en línea recta", "em linha reta", "w linii prostej", "直線距離", "직선 거리", "по прямой", "hemelsbreed", "in linea d'aria"],
  "card.stops":      ["Stops", "Halte", "Arrêts", "站点", "站點", "Paradas", "Paradas", "Przystanki", "停車駅", "정류장", "Остановки", "Haltes", "Fermate"],
  "card.vehicles":   ["Vehicles", "Fahrzeuge", "Véhicules", "车辆", "車輛", "Vehículos", "Veículos", "Pojazdy", "車両", "차량", "Машин", "Voertuigen", "Veicoli"],
  "card.interval":   ["Interval", "Takt", "Intervalle", "间隔", "間隔", "Intervalo", "Intervalo", "Częstotliwość", "運行間隔", "배차 간격", "Интервал", "Interval", "Intervallo"],
  "card.capacity":   ["Load", "Auslastung", "Charge", "载客率", "載客率", "Ocupación", "Ocupação", "Obłożenie", "乗車率", "적재율", "Загрузка", "Bezetting", "Carico"],
  "card.throughput": ["Throughput", "Durchsatz", "Débit", "运量", "運量", "Capacidad", "Capacidade", "Przepustowość", "輸送力", "수송량", "Пропускная способность", "Doorvoer", "Portata"],
  "card.loading":    ["Loading…", "Lädt…", "Chargement…", "加载中…", "載入中…", "Cargando…", "Carregando…", "Wczytywanie…", "読み込み中…", "불러오는 중…", "Загрузка…", "Laden…", "Caricamento…"],
  "card.noData":     ["No data yet", "Noch keine Daten", "Pas encore de données", "暂无数据", "尚無資料", "Sin datos aún", "Sem dados ainda", "Brak danych", "データなし", "데이터 없음", "Пока нет данных", "Nog geen gegevens", "Nessun dato"],
  "card.perYear":    ["/yr", "/J.", "/an", "/年", "/年", "/año", "/ano", "/rok", "/年", "/년", "/год", "/jr", "/anno"],
  "card.problems":   ["Problems", "Probleme", "Problèmes", "问题", "問題", "Problemas", "Problemas", "Problemy", "問題", "문제", "Проблемы", "Problemen", "Problemi"],

  "toast.cmdFailed": ["Command failed", "Befehl fehlgeschlagen", "La commande a échoué", "命令失败", "命令失敗", "El comando falló", "O comando falhou", "Polecenie nie powiodło się", "コマンド失敗", "명령 실패", "Команда не выполнена", "Opdracht mislukt", "Comando non riuscito"],
  "toast.exported":  ["Saved", "Gespeichert", "Enregistré", "已保存", "已儲存", "Guardado", "Salvo", "Zapisano", "保存しました", "저장됨", "Сохранено", "Opgeslagen", "Salvato"],
  "unit.km":         ["km", "km", "km", "公里", "公里", "km", "km", "km", "km", "km", "км", "km", "km"],
  "unit.m":          ["m", "m", "m", "米", "公尺", "m", "m", "m", "m", "m", "м", "m", "m"],
  "unit.mi":          ["mi", "mi", "mi", "英里", "英里", "mi", "mi", "mi", "マイル", "마일", "ми", "mi", "mi"],
  "unit.ft":          ["ft", "ft", "pi", "英尺", "英尺", "ft", "pés", "ft", "フィート", "피트", "фт", "ft", "ft"],
  "unit.min":        ["min", "Min.", "min", "分钟", "分鐘", "min", "min", "min", "分", "분", "мин", "min", "min"],
  "unit.s":          ["s", "s", "s", "秒", "秒", "s", "s", "s", "秒", "초", "с", "s", "s"],
};

// English is the default until the user picks another language in the settings.
function pickLang(saved) {
  return saved && LANGS[saved] ? saved : "en";
}

let CUR_LANG = "en";
function setLang(l) { CUR_LANG = LANGS[l] ? l : "en"; document.documentElement.lang = CUR_LANG; }
function t(key) {
  const row = STRINGS_TABLE[key];
  if (!row) return key;
  return row[LANG_ORDER.indexOf(CUR_LANG)] || row[0];
}

