TF3 Minimap companion
=====================

Shows your Transport Fever 3 game as a live map in a web browser:
on a second monitor, a phone or a tablet.
Needs the "Minimap Companion" mod (mod.io) enabled in your save.

START
  Windows:      double-click "TF3 Minimap.exe"
  Mac:          double-click "Start Minimap (Mac).command"
                (first time: right-click > Open, because it is not from the App Store;
                 if macOS offers to install developer tools / Python - accept, then start again)
  Linux / Deck: run ./start-minimap-linux.sh (needs python3; Steam Deck: in Desktop Mode)

Then open in a browser:
  - on this computer (e.g. on a second monitor): http://localhost:8765
  - on a phone or tablet in the same Wi-Fi: the http://192.168.x.x:8765 address the window shows
Keep the window open while you play.

FIRST START ON WINDOWS
  "Windows protected your PC": click "More info" > "Run anyway" (the program is not signed).
  Windows Firewall asks about network access: allow "Private networks",
  otherwise the phone cannot connect.

PHONE CANNOT CONNECT?
  - Phone and computer must be in the same network (not a guest Wi-Fi, no VPN on the phone).
  - Try every address the window lists.
  - Check the firewall (see above).

THE PAGE SAYS "WAITING FOR THE GAME"
  Load a save with the mod enabled. The map appears within a few seconds.

OPTIONS (command line)
  --port 9000                        another port
  --bind 127.0.0.1                   only this computer, not the network
  --userdata "<path>"                game save folder, if not found automatically:
                                     <Steam>/userdata/<your id>/3493540/local
  --game "<path>"                    game install folder (for cargo icons)

PRIVACY
  Everything stays in your home network; nothing is sent to the internet.
  Anyone in the same Wi-Fi who knows the address can see the map and move the game camera
  (use --bind 127.0.0.1 to prevent that).

----------------------------------------------------------------------------------------

Компаньон TF3 Minimap
=====================

Показывает игру Transport Fever 3 живой картой в браузере:
на втором мониторе, телефоне или планшете.
Нужен мод «Minimap Companion» (mod.io), включённый в сохранении.

ЗАПУСК
  Windows:      двойной клик по «TF3 Minimap.exe»
  Mac:          двойной клик по «Start Minimap (Mac).command»
                (в первый раз: правый клик > Открыть; если macOS предложит поставить
                 инструменты разработчика / Python - согласиться и запустить снова)
  Linux / Deck: ./start-minimap-linux.sh (нужен python3; Steam Deck - в режиме рабочего стола)

Откройте в браузере:
  - на этом компьютере (например, на втором мониторе): http://localhost:8765
  - на телефоне или планшете в той же Wi-Fi сети: адрес http://192.168.x.x:8765 из окна
Окно не закрывать, пока играете.

ПЕРВЫЙ ЗАПУСК НА WINDOWS
  «Система Windows защитила ваш компьютер»: «Подробнее» > «Выполнить в любом случае».
  Брандмауэр спросит про доступ к сети: разрешить «Частные сети», иначе телефон не подключится.

ТЕЛЕФОН НЕ ПОДКЛЮЧАЕТСЯ?
  - Телефон и компьютер в одной сети (не гостевая Wi-Fi, без VPN на телефоне).
  - Попробуйте все адреса из окна.
  - Проверьте брандмауэр.

Всё работает внутри домашней сети, в интернет ничего не отправляется.
