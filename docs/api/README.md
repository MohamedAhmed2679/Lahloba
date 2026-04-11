# API Reference

Base: `http://localhost:3000/v1` | Swagger: `/docs`

## Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/otp/request | Send OTP (phone or email) |
| POST | /auth/otp/verify | Verify OTP → JWT tokens |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Invalidate refresh token |

Dev bypass OTP: `000000`

## Meals
| GET | /meals | List meals (paginated) |
| GET | /meals/:id | Meal details + ingredients |

## Ingredient Combos
| POST | /ingredient-combos/compute | Get CHEAPEST & FASTEST options |

## Orders
| POST | /orders | Create order |
| GET | /orders/:id | Order details |
| PATCH | /orders/:id | Update status |

## Delivery
| GET | /delivery/tasks | Available tasks |
| POST | /delivery/tasks/:id/accept | Accept task |
| POST | /delivery/stops/:id/confirm | OTP confirm stop |

## Chat
| GET | /chat/rooms | List rooms |
| POST | /chat/rooms/:id/messages | Send message |

## Payments
| POST | /payments/intent | Create payment intent |
| POST | /payments/webhook | Provider webhook |

## Support & Ratings
| POST | /support/tickets | Create ticket |
| POST | /ratings | Submit rating |

All amounts in minor units (piasters). Pagination: `?page=1&page_size=20`.
