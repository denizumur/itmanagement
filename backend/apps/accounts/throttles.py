from rest_framework.throttling import SimpleRateThrottle


class LoginRateThrottle(SimpleRateThrottle):
    scope = "login"

    def parse_rate(self, rate):
        """
        DRF default olarak 5/min, 100/day gibi formatları destekler.
        Biz 5/5m gibi daha okunur bir format da destekliyoruz.
        """
        if rate is None:
            return (None, None)

        num, period = rate.split("/")
        num_requests = int(num)

        unit = period[-1]
        amount_text = period[:-1]

        if amount_text.isdigit() and unit in {"s", "m", "h", "d"}:
            amount = int(amount_text)
            seconds_per_unit = {
                "s": 1,
                "m": 60,
                "h": 60 * 60,
                "d": 60 * 60 * 24,
            }

            return (num_requests, amount * seconds_per_unit[unit])

        return super().parse_rate(rate)

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)

        username_or_email = (
            request.data.get("email")
            or request.data.get("username")
            or request.data.get("login")
            or ""
        )

        username_or_email = str(username_or_email).strip().lower()

        if username_or_email:
            ident = f"{ident}:{username_or_email}"

        return self.cache_format % {
            "scope": self.scope,
            "ident": ident,
        }