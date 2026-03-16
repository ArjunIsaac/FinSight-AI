import edge_tts
import asyncio
import os
import time
import uuid


class EdgeTTSService:
    def __init__(self):
        # Structure: language_code -> [Display Name, Female Voice, Male Voice]
        # When male voice is unavailable the same voice string is repeated.
        self.languages = {
            'as':  ['Assamese',      'as-IN-YashicaNeural',    'as-IN-YashicaNeural'],
            'bn':  ['Bengali',       'bn-IN-TanishaaNeural',   'bn-IN-BashkarNeural'],
            'brx': ['Bodo',          'brx-IN-GargiNeural',     'brx-IN-JitendraNeural'],
            'doi': ['Dogri',         'doi-IN-KiranNeural',     'doi-IN-KiranNeural'],
            'en':  ['Indian English','en-IN-NeerjaNeural',     'en-IN-PrabhatNeural'],
            'gu':  ['Gujarati',      'gu-IN-DhwaniNeural',     'gu-IN-NiranjanNeural'],
            'hi':  ['Hindi',         'hi-IN-SwaraNeural',      'hi-IN-MadhurNeural'],
            'kn':  ['Kannada',       'kn-IN-SapnaNeural',      'kn-IN-GaganNeural'],
            'ks':  ['Kashmiri',      'ks-IN-AsmitaNeural',     'ks-IN-AsmitaNeural'],
            'kok': ['Konkani',       'kok-IN-KalpanaNeural',   'kok-IN-KalpanaNeural'],
            'mai': ['Maithili',      'mai-IN-KusumNeural',     'mai-IN-KusumNeural'],
            'ml':  ['Malayalam',     'ml-IN-SobhanaNeural',    'ml-IN-MidhunNeural'],
            'mni': ['Manipuri',      'mni-IN-VeenaNeural',     'mni-IN-VeenaNeural'],
            'mr':  ['Marathi',       'mr-IN-AarohiNeural',     'mr-IN-ManoharNeural'],
            'ne':  ['Nepali',        'ne-IN-SamriddhiNeural',  'ne-IN-SamriddhiNeural'],
            'or':  ['Odia',          'or-IN-SubhasiniNeural',  'or-IN-SubhasiniNeural'],
            'pa':  ['Punjabi',       'pa-IN-GurleenNeural',    'pa-IN-GurleenNeural'],
            'sa':  ['Sanskrit',      'sa-IN-BhavanaNeural',    'sa-IN-BhavanaNeural'],
            'sat': ['Santali',       'sat-IN-ChinmayiNeural',  'sat-IN-ChinmayiNeural'],
            'sd':  ['Sindhi',        'sd-IN-KiranNeural',      'sd-IN-KiranNeural'],
            'ta':  ['Tamil',         'ta-IN-PallaviNeural',    'ta-IN-ValluvarNeural'],
            'te':  ['Telugu',        'te-IN-ShrutiNeural',     'te-IN-MohanNeural'],
            'ur':  ['Urdu',          'ur-IN-GulNeural',        'ur-IN-SalmanNeural'],
        }

        self._native_names = {
            'as':  'অসমীয়া',
            'bn':  'বাংলা',
            'brx': "बर'",
            'doi': 'डोगरी',
            'en':  'English',
            'gu':  'ગુજરાતી',
            'hi':  'हिन्दी',
            'kn':  'ಕನ್ನಡ',
            'ks':  'कॉशुर',
            'kok': 'कोंकणी',
            'mai': 'मैथिली',
            'ml':  'മലയാളം',
            'mni': 'মৈতৈলোন্',
            'mr':  'मराठी',
            'ne':  'नेपाली',
            'or':  'ଓଡ଼ିଆ',
            'pa':  'ਪੰਜਾਬੀ',
            'sa':  'संस्कृतम्',
            'sat': 'ᱥᱟᱱᱛᱟᱲᱤ',
            'sd':  'سنڌي',
            'ta':  'தமிழ்',
            'te':  'తెలుగు',
            'ur':  'اردو',
        }

        os.makedirs("audio", exist_ok=True)

    # ── Public API ─────────────────────────────────────────────────────────────

    def get_language_list(self):
        """Return a sorted list of supported languages for the UI."""
        return sorted(
            [
                {
                    "code": code,
                    "name": data[0],
                    "native_name": self._native_names.get(code, code),
                }
                for code, data in self.languages.items()
            ],
            key=lambda x: x["name"],
        )

    async def text_to_speech(self, text: str, language: str = "hi", voice_type: str = "female") -> dict:
        """
        Convert *text* to speech using Microsoft Edge TTS.

        Returns a dict with keys:
            success  (bool)
            file     (str)  – path to the generated .mp3, only when success=True
            voice    (str)
            language (str)
            language_name (str)
            error    (str)  – only when success=False
        """
        # BUG FIX: guard against unsupported language codes
        if language not in self.languages:
            return {
                "success": False,
                "error": f"Language '{language}' is not supported. "
                         f"Supported codes: {sorted(self.languages.keys())}",
            }

        lang_data = self.languages[language]

        # BUG FIX: index 1 = female, index 2 = male (was previously handled
        # with a fragile len() check; the list always has 3 items so just index directly)
        voice = lang_data[2] if voice_type == "male" else lang_data[1]

        filename = os.path.join("audio", f"{uuid.uuid4()}.mp3")

        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filename)

            return {
                "success": True,
                "file": filename,
                "voice": voice,
                "language": language,
                "language_name": lang_data[0],
            }

        except Exception as e:
            # Clean up partial file if it was created
            if os.path.exists(filename):
                os.remove(filename)

            return {
                "success": False,
                "error": str(e),
            }

    async def get_voice_list(self):
        """Return all Indian-locale voices available from Edge TTS."""
        voices = await edge_tts.list_voices()
        return [
            {
                "name": v["ShortName"],
                "locale": v["Locale"],
                "gender": v["Gender"],
                "language": v["Locale"].split("-")[0],
            }
            for v in voices
            if "IN" in v.get("Locale", "")
        ]

    def cleanup_old_files(self, hours: int = 24):
        """Delete audio files that are older than *hours* hours."""
        cutoff = time.time() - hours * 3600
        removed = 0
        for filename in os.listdir("audio"):
            filepath = os.path.join("audio", filename)
            if os.path.isfile(filepath) and os.path.getmtime(filepath) < cutoff:
                try:
                    os.remove(filepath)
                    removed += 1
                except OSError as e:
                    print(f"Could not delete {filepath}: {e}")
        print(f"Cleaned up {removed} old audio file(s).")
