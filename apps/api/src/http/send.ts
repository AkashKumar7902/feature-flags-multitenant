import type { Response } from "express";

export function sendData<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

export function sendMessage(res: Response, message: string, status = 200) {
  return res.status(status).json({ data: { message } });
}
