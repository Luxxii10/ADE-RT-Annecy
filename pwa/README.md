# EDT Labo RT — PWA

Emploi du temps du département R&T de l'IUT d'Annecy, installable sur
téléphone et ordinateur, et utilisable sans réseau.

## Contenu

```
pwa/
├── index.html             l'appli (HTML, CSS et JS dans un seul fichier)
├── sw.js                  service worker : cache de l'appli et des polices
├── manifest.webmanifest   nom, couleurs et icônes pour l'installation
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Mise en ligne

Déposer le dossier tel quel sur un hébergement **HTTPS** (GitHub Pages
convient). Les cinq fichiers doivent rester ensemble : `sw.js` ne
contrôle que les pages de son propre dossier.

Après une modification de `sw.js`, changer `VERSION` en tête du fichier
pour que les navigateurs remplacent l'ancien cache.

## Hors ligne

- L'appli et les polices sont mises en cache par `sw.js` à la première visite.
- Les **5 derniers emplois du temps chargés** sont copiés par la page dans le
  cache `ade-edt-hors-ligne`. Au-delà de 5, le plus ancien est supprimé.
- S'il existe une copie, elle s'affiche tout de suite et le réseau la
  remplace en arrière-plan s'il répond. Le badge « Copie du … » dans la
  barre du haut indique qu'on regarde une copie.
- Les voyants de disponibilité des salles et des profs ont besoin du réseau.

## Tester en local

Un service worker ne fonctionne qu'en HTTPS ou sur `localhost` :

```bash
python -m http.server 8765 --directory pwa
```

puis ouvrir http://localhost:8765/. Pour vérifier le hors ligne : charger un
EDT, couper le serveur, recharger la page.
