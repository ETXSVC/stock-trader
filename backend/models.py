from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.database import Base


class Stock(Base):
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    sector = Column(String, default="")
    source = Column(String, nullable=False)  # "sp500" or "custom"
    active = Column(Boolean, default=True)

    samples = relationship("Sample", back_populates="stock", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="stock", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    sample_type = Column(String, nullable=False)  # "open", "mid", "close"
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    price = Column(Float)
    volume = Column(Integer)
    bid = Column(Float)
    ask = Column(Float)
    market_cap = Column(Float)
    day_change_pct = Column(Float)

    stock = relationship("Stock", back_populates="samples")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=True)
    condition = Column(String, nullable=False)  # price_above, price_below, volume_spike, change_pct
    threshold = Column(Float, nullable=False)
    enabled = Column(Boolean, default=True)

    stock = relationship("Stock", back_populates="alerts")
    notifications = relationship("Notification", back_populates="alert", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    triggered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False)

    alert = relationship("Alert", back_populates="notifications")
    stock = relationship("Stock")
