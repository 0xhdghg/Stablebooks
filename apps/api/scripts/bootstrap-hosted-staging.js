const crypto = require("node:crypto");

async function bootstrapHostedStaging(config = readConfig()) {
  const auth = await resolveOperatorSession(config);
  const organization = await resolveOrganization(config, auth.token);
  const wallet = await resolveDefaultWallet(config, auth.token);
  const customer = await resolveCustomer(config, auth.token);
  return buildSummary(config, auth, organization, wallet, customer);
}

async function resolveOperatorSession(config) {
  const signupBody = {
    email: config.operator.email,
    password: config.operator.password,
    name: config.operator.name
  };

  try {
    const signup = await request(config, "/auth/signup", {
      method: "POST",
      body: signupBody
    });

    return {
      mode: "signup",
      token: signup.data.token,
      user: signup.data.user
    };
  } catch (error) {
    if (!String(error.message).includes("already exists")) {
      throw error;
    }
  }

  const signin = await request(config, "/auth/signin", {
    method: "POST",
    body: {
      email: config.operator.email,
      password: config.operator.password
    }
  });

  return {
    mode: "signin",
    token: signin.data.token,
    user: signin.data.user
  };
}

async function resolveOrganization(config, token) {
  const current = await request(config, "/organizations/current", {
    authToken: token
  });

  if (current.data) {
    return {
      created: false,
      organization: current.data
    };
  }

  const created = await request(config, "/organizations", {
    method: "POST",
    authToken: token,
    body: {
      name: config.organization.name,
      billingCountry: config.organization.billingCountry,
      baseCurrency: config.organization.baseCurrency
    }
  });

  return {
    created: true,
    organization: created.data.organization
  };
}

async function resolveDefaultWallet(config, token) {
  const list = await request(config, "/wallets", {
    authToken: token
  });
  const wallets = Array.isArray(list.data) ? list.data : [];
  const exact = wallets.find(
    (wallet) =>
      wallet.address.toLowerCase() === config.wallet.address.toLowerCase() &&
      wallet.chain.toLowerCase() === config.wallet.chain.toLowerCase()
  );

  if (exact) {
    return {
      created: false,
      wallet: exact
    };
  }

  const currentDefault = wallets.find((wallet) => wallet.isDefaultSettlement);
  if (currentDefault) {
    return {
      created: false,
      wallet: currentDefault
    };
  }

  const created = await request(config, "/wallets", {
    method: "POST",
    authToken: token,
    body: {
      chain: config.wallet.chain,
      address: config.wallet.address,
      label: config.wallet.label,
      role: config.wallet.role,
      isDefaultSettlement: true
    }
  });

  return {
    created: true,
    wallet: created.data
  };
}

async function resolveCustomer(config, token) {
  const list = await request(config, "/customers", {
    authToken: token
  });
  const customers = Array.isArray(list.data) ? list.data : [];
  const existing = customers.find(
    (customer) => customer.email.toLowerCase() === config.customer.email.toLowerCase()
  );

  if (existing) {
    return {
      created: false,
      customer: existing
    };
  }

  const created = await request(config, "/customers", {
    method: "POST",
    authToken: token,
    body: {
      name: config.customer.name,
      email: config.customer.email,
      billingCurrency: config.customer.billingCurrency
    }
  });

  return {
    created: true,
    customer: created.data
  };
}

function buildSummary(config, auth, organization, wallet, customer) {
  const summary = {
    ok: true,
    apiBaseUrl: config.apiBaseUrl,
    webBaseUrl: config.webBaseUrl,
    operator: {
      mode: auth.mode,
      email: config.operator.email,
      password: config.operator.password,
      token: auth.token,
      userId: auth.user.id
    },
    organization: {
      created: organization.created,
      id: organization.organization.id,
      name: organization.organization.name
    },
    wallet: {
      created: wallet.created,
      id: wallet.wallet.id,
      chain: wallet.wallet.chain,
      address: wallet.wallet.address,
      isDefaultSettlement: wallet.wallet.isDefaultSettlement
    },
    customer: {
      created: customer.created,
      id: customer.customer.id,
      email: customer.customer.email,
      name: customer.customer.name
    },
    smokeEnv: {
      SMOKE_API_BASE_URL: config.apiBaseUrl,
      SMOKE_WEB_BASE_URL: config.webBaseUrl,
      SMOKE_OPERATOR_TOKEN: auth.token,
      SMOKE_CUSTOMER_ID: customer.customer.id,
      SMOKE_SETTLEMENT_WALLET: wallet.wallet.address,
      ARC_CHAIN_ID: config.arc.chainId,
      ARC_WEBHOOK_SECRET: config.arc.webhookSecret,
      ARC_EVENT_CONTRACT_ADDRESS: config.arc.contractAddress,
      ARC_EVENT_SIGNATURE: config.arc.eventSignature,
      ARC_EVENT_TOKEN_SYMBOL: config.arc.tokenSymbol,
      ARC_EVENT_TOKEN_DECIMALS: String(config.arc.tokenDecimals)
    }
  };

  return summary;
}

function renderEnvBlock(summary) {
  return Object.entries(summary.smokeEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function readConfig() {
  const now = Date.now();
  const suffix = `${Math.floor(now / 1000)}${crypto.randomBytes(2).toString("hex")}`;

  return {
    apiBaseUrl: requireEnv("STABLEBOOKS_API_BASE_URL", "SMOKE_API_BASE_URL").replace(
      /\/+$/,
      ""
    ),
    webBaseUrl:
      optionalEnv("STABLEBOOKS_WEB_BASE_URL") ??
      optionalEnv("SMOKE_WEB_BASE_URL") ??
      "https://stablebooks-web-production.up.railway.app",
    operator: {
      email:
        optionalEnv("STAGING_OPERATOR_EMAIL") ??
        `operator+${suffix}@stablebooks.dev`,
      password:
        optionalEnv("STAGING_OPERATOR_PASSWORD") ??
        `Stablebooks!${suffix}`,
      name: optionalEnv("STAGING_OPERATOR_NAME") ?? "Stablebooks Operator"
    },
    organization: {
      name: optionalEnv("STAGING_ORG_NAME") ?? "Stablebooks Staging",
      billingCountry: optionalEnv("STAGING_BILLING_COUNTRY") ?? "US",
      baseCurrency: optionalEnv("STAGING_BASE_CURRENCY") ?? "USD"
    },
    wallet: {
      chain: optionalEnv("STAGING_SETTLEMENT_CHAIN") ?? "arc",
      address:
        optionalEnv("STAGING_SETTLEMENT_WALLET") ??
        `0x${crypto.randomBytes(20).toString("hex")}`,
      label: optionalEnv("STAGING_SETTLEMENT_LABEL") ?? "Primary Settlement",
      role: "collection"
    },
    customer: {
      name: optionalEnv("STAGING_CUSTOMER_NAME") ?? "Acme Smoke",
      email:
        optionalEnv("STAGING_CUSTOMER_EMAIL") ??
        `smoke+${suffix}@stablebooks.dev`,
      billingCurrency: optionalEnv("STAGING_CUSTOMER_CURRENCY") ?? "USD"
    },
    arc: {
      chainId: requireIntegerEnv("ARC_CHAIN_ID"),
      webhookSecret: requireEnv("ARC_WEBHOOK_SECRET"),
      contractAddress: requireEnv("ARC_EVENT_CONTRACT_ADDRESS"),
      eventSignature: requireEnv("ARC_EVENT_SIGNATURE"),
      tokenSymbol: requireEnv("ARC_EVENT_TOKEN_SYMBOL"),
      tokenDecimals: requireIntegerEnv("ARC_EVENT_TOKEN_DECIMALS")
    }
  };
}

async function request(config, pathname, input = {}) {
  const response = await fetch(`${config.apiBaseUrl}${pathname}`, {
    method: input.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(input.authToken
        ? { Authorization: `Bearer ${input.authToken}` }
        : {})
    },
    body: input.body ? JSON.stringify(input.body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload?.message ??
      `HTTP ${response.status} for ${pathname}`;
    throw new Error(
      `${message} (${pathname}, status ${response.status})`
    );
  }

  return payload;
}

function requireEnv(...names) {
  for (const name of names) {
    const value = optionalEnv(name);
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function requireIntegerEnv(...names) {
  const value = Number(requireEnv(...names));
  if (!Number.isInteger(value)) {
    throw new Error(`Env var ${names.join(" or ")} must be an integer.`);
  }

  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

async function runCli() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const envOnly = args.has("--env");
  const config = readConfig();

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          apiBaseUrl: config.apiBaseUrl,
          webBaseUrl: config.webBaseUrl,
          operatorEmail: config.operator.email,
          organizationName: config.organization.name,
          settlementWallet: {
            chain: config.wallet.chain,
            address: config.wallet.address,
            label: config.wallet.label
          },
          customerEmail: config.customer.email
        },
        null,
        2
      )
    );
    return;
  }

  const summary = await bootstrapHostedStaging(config);

  if (envOnly) {
    console.log(renderEnvBlock(summary));
    return;
  }

  console.log(JSON.stringify(summary, null, 2));
}

module.exports = {
  bootstrapHostedStaging,
  readConfig,
  renderEnvBlock
};

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
