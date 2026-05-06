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
    alerts = relationship("Alert", back_populates="stock", cascade="all")


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


class ScheduledJob(Base):
    __tablename__ = "scheduled_jobs"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)       # display name, e.g. "Market Open"
    sample_type = Column(String, nullable=False)  # "open", "mid", "close", or any custom label
    hour = Column(Integer, nullable=False)        # 0-23, stored in UTC
    minute = Column(Integer, nullable=False)      # 0-59
    enabled = Column(Boolean, default=True)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    priority = Column(String, default="medium")  # low, medium, high
    due_date = Column(String, nullable=True)      # ISO date string "YYYY-MM-DD"
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
