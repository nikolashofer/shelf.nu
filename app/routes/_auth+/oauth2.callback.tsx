import {
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import { useLoaderData } from "react-router";
import { Button } from "~/components/shared/button";
import { Spinner } from "~/components/shared/spinner";
import { mapAuthSession } from "~/modules/auth/mappers.server";
import {
  getSelectedOrganisation,
  setSelectedOrganizationIdCookie,
} from "~/modules/organization/context.server";
import { createUser, getUserByID } from "~/modules/user/service.server"; // ADD THIS
import { setCookie } from "~/utils/cookies.server";
import { SUPABASE_ANON_PUBLIC, SUPABASE_URL } from "~/utils/env";
import { safeRedirect } from "~/utils/http.server";
import { randomUsernameFromEmail } from "~/utils/user"; // ADD THIS

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (data?.error) {
    return [{ title: "Authentication Error" }];
  }

  return [{ title: "Signing you in…" }];
};

export async function loader({ context, request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  console.log(requestUrl.searchParams);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";
  const headers = new Headers();

  if (!code) {
    return { error: { message: "Authorization code missing." } };
  }

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_PUBLIC!, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "").map(
          ({ name, value }) => ({
            name,
            value: value ?? "",
          })
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          headers.append(
            "Set-Cookie",
            serializeCookieHeader(name, value, options)
          )
        );
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (data.session) {
    const authSession = mapAuthSession(data.session);

    // ===== ADD THIS SECTION =====
    // Check if user exists in database, if not create them
    try {
      await getUserByID(authSession.userId);
    } catch (userNotFoundError) {
      // User doesn't exist, create them with a personal workspace
      const userMetadata = data.session.user.user_metadata;

      // Extract name from Google metadata
      const fullName = userMetadata?.full_name || "";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || userMetadata?.given_name || "";
      const lastName =
        nameParts.slice(1).join(" ") || userMetadata?.family_name || "";

      await createUser({
        email: authSession.email,
        userId: authSession.userId,
        username: randomUsernameFromEmail(authSession.email),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        isSSO: true,
      });
    }
    // ===== END NEW SECTION =====

    const { organizationId } = await getSelectedOrganisation({
      userId: authSession.userId,
      request,
    });

    //@ts-expect-error
    context.setSession(authSession);

    return redirect(safeRedirect("/assets"), {
      headers: [
        setCookie(await setSelectedOrganizationIdCookie(organizationId)),
      ],
    });
  }

  if (!error) {
    return redirect(next, { headers });
  }

  return { error: { message: error.message } };
}

export default function OAuth2Callback() {
  const data = useLoaderData<typeof loader>();
  const validationErrors = (data?.error as any)?.validationErrors;

  return (
    <div className="flex justify-center text-center">
      {data?.error ? (
        <div>
          {validationErrors ? (
            Object.values(validationErrors).map((error: any) => (
              <div className="text-sm text-error-500" key={error.message}>
                {error.message}
              </div>
            ))
          ) : (
            <div className="text-sm text-error-500">{data.error.message}</div>
          )}
          <Button to="/" className="mt-4">
            Back to login
          </Button>
        </div>
      ) : (
        <Spinner />
      )}
    </div>
  );
}
