from fastapi import APIRouter, HTTPException, status
from getstream import StreamException

from roomtone_api.dependencies import CurrentUser, StreamGatewayDependency
from roomtone_api.schemas.session import StreamTokenResponse, UserResponse

router = APIRouter(tags=["stream"])


@router.post("/v1/stream-token", response_model=StreamTokenResponse)
async def create_stream_token(
    current_user: CurrentUser,
    gateway: StreamGatewayDependency,
) -> StreamTokenResponse:
    try:
        token = await gateway.upsert_user_and_create_token(current_user)
    except StreamException as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stream is temporarily unavailable.",
        ) from error

    return StreamTokenResponse(
        api_key=gateway.api_key,
        token=token,
        expires_in=gateway.token_ttl_seconds,
        user=UserResponse.model_validate(current_user),
    )
