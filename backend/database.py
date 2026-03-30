from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.mysql import LONGTEXT
import datetime
import os
from dotenv import load_dotenv

load_dotenv()

# Format: mysql+pymysql://root:password@localhost:3306/finsight_ai
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# BUG FIX: Guard against missing DATABASE_URL before engine creation
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError(
        "DATABASE_URL is not set. Add it to your .env file.\n"
        "Example: DATABASE_URL=mysql+pymysql://root:password@localhost:3306/finsight_ai"
    )

# pool_pre_ping=True prevents "MySQL server has gone away" errors on idle connections
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,   # Recycle connections after 1 hour to avoid stale handles
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Chat Message Table ────────────────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20))                              # "user" or "model"
    content = Column(Text)                                 # The actual message text
    language = Column(String(10), default="en")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)


# ── PDF Storage Table ─────────────────────────────────────────────────────────

class PDFDocument(Base):
    __tablename__ = "pdf_documents"

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(String(50), unique=True, index=True)
    filename = Column(String(255))

    # BUG FIX: MySQL Text() is capped at 65 535 bytes.
    # Real financial PDFs (annual reports, 10-Ks) can easily be several MB of text.
    # LONGTEXT supports up to 4 GB — use it here to avoid silent truncation.
    content = Column(LONGTEXT)

    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── DB Helpers ────────────────────────────────────────────────────────────────

def init_db():
    """Create all tables if they don't already exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency: yields a DB session and closes it when done."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
