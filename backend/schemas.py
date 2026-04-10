from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# --- Stock ---
class StockCreate(BaseModel):
    ticker: str
    name: str
    sector: str = ""


class StockUpdate(BaseModel):
    name: Optional[str] = None
    sector: Optional[str] = None
    active: Optional[bool] = None


class StockResponse(BaseModel):
    id: int
    ticker: str
    name: str
    sector: str
    source: str
    active: bool

    model_config = {"from_attributes": True}


# --- Sample ---
class SampleResponse(BaseModel):
    id: int
    stock_id: int
    sample_type: str
    timestamp: datetime
    price: Optional[float] = None
    volume: Optional[int] = None
    bid: Optional[float] = None
    ask: Optional[float] = None
    market_cap: Optional[float] = None
    day_change_pct: Optional[float] = None

    model_config = {"from_attributes": True}


class SampleWithTicker(SampleResponse):
    ticker: str
    name: str


class TopMoverResponse(BaseModel):
    ticker: str
    name: str
    price: Optional[float] = None
    volume: Optional[int] = None
    day_change_pct: Optional[float] = None
    sparkline: list[Optional[float]]


# --- Alert ---
class AlertCreate(BaseModel):
    stock_id: Optional[int] = None
    condition: str  # price_above, price_below, volume_spike, change_pct
    threshold: float


class AlertUpdate(BaseModel):
    condition: Optional[str] = None
    threshold: Optional[float] = None
    enabled: Optional[bool] = None


class AlertResponse(BaseModel):
    id: int
    stock_id: Optional[int] = None
    condition: str
    threshold: float
    enabled: bool
    ticker: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Notification ---
class NotificationResponse(BaseModel):
    id: int
    alert_id: int
    stock_id: int
    triggered_at: datetime
    message: str
    read: bool
    ticker: Optional[str] = None

    model_config = {"from_attributes": True}


# --- Trigger ---
class TriggerRequest(BaseModel):
    sample_type: str = "mid"  # open, mid, close


# --- ScheduledJob ---
class ScheduledJobCreate(BaseModel):
    label: str
    sample_type: str = "mid"
    hour: int       # 0-23 UTC
    minute: int     # 0-59


class ScheduledJobUpdate(BaseModel):
    label: Optional[str] = None
    sample_type: Optional[str] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    enabled: Optional[bool] = None


class ScheduledJobResponse(BaseModel):
    id: int
    label: str
    sample_type: str
    hour: int
    minute: int
    enabled: bool

    model_config = {"from_attributes": True}
