__version__ = "0.1.0"


def main() -> None:
    """Run the API using the project script."""
    import uvicorn

    uvicorn.run("roomtone_api.main:app", host="127.0.0.1", port=8000)
