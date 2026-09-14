# Sananjuuri

Suomenkielinen PWA-sanapeli. Pelaaja kasvattaa sanan 3 kirjaimesta 8 kirjaimeen niin, että jokainen seuraava sana käyttää edellisen sanan kirjaimet ja yhden uuden kirjaimen.

Sovellus on staattinen ja toimii myös offline-tilassa service workerin välimuistin avulla.

## Paikallinen ajo

```powershell
python -m http.server 8891 --bind 0.0.0.0
```

Paikallinen osoite:

```text
http://127.0.0.1:8891/?v=20
```

Lähiverkossa:

```text
http://192.168.1.105:8891/?v=20
```
