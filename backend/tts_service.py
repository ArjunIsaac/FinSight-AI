import edge_tts
import asyncio
import os
from datetime import datetime
import uuid

class EdgeTTSService:
    def __init__(self):
        # All 22 Official Indian Languages + English
        self.languages = {
            # Language Code: [Name, Voice Female, Voice Male]
            'as': ['Assamese', 'as-IN-YashicaNeural', 'as-IN-YashicaNeural'],  # Male not available
            'bn': ['Bengali', 'bn-IN-TanishaaNeural', 'bn-IN-BashkarNeural'],
            'brx': ['Bodo', 'brx-IN-GargiNeural', 'brx-IN-JitendraNeural'],
            'doi': ['Dogri', 'doi-IN-KiranNeural', 'doi-IN-KiranNeural'],  # Same voice
            'en': ['Indian English', 'en-IN-NeerjaNeural', 'en-IN-PrabhatNeural'],
            'gu': ['Gujarati', 'gu-IN-DhwaniNeural', 'gu-IN-NiranjanNeural'],
            'hi': ['Hindi', 'hi-IN-SwaraNeural', 'hi-IN-MadhurNeural'],
            'kn': ['Kannada', 'kn-IN-SapnaNeural', 'kn-IN-GaganNeural'],
            'ks': ['Kashmiri', 'ks-IN-AsmitaNeural', 'ks-IN-AsmitaNeural'],  # Same voice
            'kok': ['Konkani', 'kok-IN-KalpanaNeural', 'kok-IN-KalpanaNeural'],
            'mai': ['Maithili', 'mai-IN-KusumNeural', 'mai-IN-KusumNeural'],
            'ml': ['Malayalam', 'ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'],
            'mni': ['Manipuri', 'mni-IN-VeenaNeural', 'mni-IN-VeenaNeural'],
            'mr': ['Marathi', 'mr-IN-AarohiNeural', 'mr-IN-ManoharNeural'],
            'ne': ['Nepali', 'ne-IN-SamriddhiNeural', 'ne-IN-SamriddhiNeural'],
            'or': ['Odia', 'or-IN-SubhasiniNeural', 'or-IN-SubhasiniNeural'],
            'pa': ['Punjabi', 'pa-IN-GurleenNeural', 'pa-IN-GurleenNeural'],  # Same voice
            'sa': ['Sanskrit', 'sa-IN-BhavanaNeural', 'sa-IN-BhavanaNeural'],
            'sat': ['Santali', 'sat-IN-ChinmayiNeural', 'sat-IN-ChinmayiNeural'],
            'sd': ['Sindhi', 'sd-IN-KiranNeural', 'sd-IN-KiranNeural'],
            'ta': ['Tamil', 'ta-IN-PallaviNeural', 'ta-IN-ValluvarNeural'],
            'te': ['Telugu', 'te-IN-ShrutiNeural', 'te-IN-MohanNeural'],
            'ur': ['Urdu', 'ur-IN-GulNeural', 'ur-IN-SalmanNeural'],
        }
        
        # Create audio directory
        os.makedirs("audio", exist_ok=True)
    
    def get_language_list(self):
        """Return list of supported languages for UI"""
        lang_list = []
        for code, data in self.languages.items():
            lang_list.append({
                'code': code,
                'name': data[0],
                'native_name': self.get_native_name(code)
            })
        return sorted(lang_list, key=lambda x: x['name'])
    
    def get_native_name(self, code):
        """Get native language name"""
        native_names = {
            'as': 'অসমীয়া',
            'bn': 'বাংলা',
            'brx': "बर'",
            'doi': 'डोगरी',
            'en': 'English',
            'gu': 'ગુજરાતી',
            'hi': 'हिन्दी',
            'kn': 'ಕನ್ನಡ',
            'ks': 'कॉशुर',
            'kok': 'कोंकणी',
            'mai': 'मैथिली',
            'ml': 'മലയാളം',
            'mni': 'মৈতৈলোন্',
            'mr': 'मराठी',
            'ne': 'नेपाली',
            'or': 'ଓଡ଼ିଆ',
            'pa': 'ਪੰਜਾਬੀ',
            'sa': 'संस्कृतम्',
            'sat': 'ᱥᱟᱱᱛᱟᱲᱤ',
            'sd': 'سنڌي',
            'ta': 'தமிழ்',
            'te': 'తెలుగు',
            'ur': 'اردو'
        }
        return native_names.get(code, code)
    
    async def text_to_speech(self, text, language='hi', voice_type='female'):
        """Convert text to speech using Edge-TTS"""
        try:
            # Get voice based on language and gender
            voice_key = language
            if voice_type == 'male' and language in self.languages:
                # Try to get male voice (index 2)
                if len(self.languages[language]) > 2:
                    voice = self.languages[language][2]
                else:
                    voice = self.languages[language][1]  # Fallback to female
            else:
                voice = self.languages[language][1]  # Female voice
            
            # Generate unique filename
            filename = f"audio/{uuid.uuid4()}.mp3"
            
            # Generate speech
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filename)
            
            return {
                "success": True,
                "file": filename,
                "voice": voice,
                "language": language,
                "language_name": self.languages[language][0]
            }
            
        except Exception as e:
            print(f"TTS Error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_voice_list(self):
        """Get all available Indian voices"""
        voices = await edge_tts.list_voices()
        indian_voices = []
        for voice in voices:
            if 'IN' in voice['Locale']:
                indian_voices.append({
                    'name': voice['ShortName'],
                    'locale': voice['Locale'],
                    'gender': voice['Gender'],
                    'language': voice['Locale'].split('-')[0]
                })
        return indian_voices
    
    def cleanup_old_files(self, hours=24):
        """Delete audio files older than specified hours"""
        import time
        now = time.time()
        for filename in os.listdir("audio"):
            filepath = os.path.join("audio", filename)
            if os.path.isfile(filepath):
                file_time = os.path.getmtime(filepath)
                if now - file_time > hours * 3600:
                    os.remove(filepath)
                    print(f"Deleted old audio: {filename}")