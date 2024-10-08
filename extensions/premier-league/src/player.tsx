import { Action, ActionPanel, Detail, Grid, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import json2md from "json2md";
import { useMemo, useState } from "react";
import {
  getPlayers,
  getPlayersWithTerms,
  getSeasons,
  getStaffs,
  getTeams,
} from "./api";
import { Award, Club, PlayerContent } from "./types";
import { getFlagEmoji } from "./utils";

const awardMap: { [key: string]: string } = {
  GOLDEN_GLOVE: "Golden Glove",
  CHAMPIONS: "Premier League Champion",
  PLAYER_OF_THE_MONTH: "Player of the Month",
  GOAL_OF_THE_MONTH: "Goal of the Month",
  GOLDEN_BOOT: "Golden Boot",
  PLAYER_OF_THE_SEASON: "Player of the Season",
  SAVE_OF_THE_MONTH: "Save of the Month",
  MANAGER_OF_THE_MONTH: "Manager of the Month",
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function PlayerProfile(props: PlayerContent) {
  return (
    <Detail
      navigationTitle={`${props.name.display} | Profile & Stats`}
      markdown={json2md([
        { h1: props.name.display },
        {
          img: {
            source: `https://resources.premierleague.com/premierleague/photos/players/250x250/${props.altIds.opta}.png`,
          },
        },
        {
          h2: "Premier League Record",
        },
        {
          p: [
            `Appearances: ${props.appearances || 0}`,
            `Clean sheets: ${props.cleanSheets || 0}`,
            `Goals: ${props.goals || 0}`,
            `Assists: ${props.assists || 0}`,
          ],
        },
        {
          h2: props.awards ? "Honours & Awards" : "",
        },
        ...Object.entries(props.awards || {})
          .map(([key, awards]) => {
            return [
              {
                h3: awardMap[key] || key,
              },
              {
                ul: awards.map((award: Award) => {
                  return key.endsWith("MONTH")
                    ? `${months[award.date.month - 1]} ${
                        award.compSeason.label
                      }`
                    : award.compSeason.label;
                }),
              },
            ];
          })
          .flat(),
      ])}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Nationality"
            icon={getFlagEmoji(props.nationalTeam?.isoCode)}
            text={props.nationalTeam?.country}
          />
          <Detail.Metadata.Label
            title="Date of Birth"
            text={props.birth.date.label}
          />
          <Detail.Metadata.Label
            title="Height (cm)"
            text={props.height?.toString()}
          />
          <Detail.Metadata.Label title="Age" text={props.age} />
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label
            title="Joined Date"
            text={props.joinDate?.label}
          />
          <Detail.Metadata.Label
            title="Position"
            text={props.info.positionInfo}
          />
          <Detail.Metadata.Label
            title="Shirt Number"
            text={props.info.shirtNum?.toString()}
          />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser
            url={`https://www.premierleague.com/players/${
              props.id
            }/${props.name.display.replace(/ /g, "-")}/overview`}
          />
        </ActionPanel>
      }
    />
  );
}

export default function Player(props: { club: Club }) {
  const [teamId, setTeam] = useState<string>(props.club?.id.toString() ?? "-1");

  const { data: seasons = [] } = usePromise(getSeasons);

  const compSeasons = useMemo(() => seasons[0]?.id.toString(), [seasons]);

  const { data: teams } = usePromise(
    async (season) => {
      return season ? await getTeams(season) : [];
    },
    [compSeasons],
  );

  const [terms, setTerms] = useState<string>("");

  const { isLoading, data, pagination } = usePromise(
    (season, team, terms) =>
      async ({ page = 0 }) => {
        if (terms.length >= 3) {
          return getPlayersWithTerms(terms, page);
        } else if (team && season) {
          if (team === "-1") {
            return getPlayers(team, season, page);
          } else {
            return getStaffs(team, season);
          }
        }

        return { data: [], hasMore: false };
      },
    [compSeasons, teamId, terms],
  );

  const listProps: Partial<Grid.Props> = props.club
    ? {
        navigationTitle: `Squad | ${props.club.name} | Club`,
      }
    : {
        navigationTitle: "Players",
        searchBarAccessory: (
          <Grid.Dropdown
            tooltip="Filter by Club"
            value={teamId}
            onChange={setTeam}
          >
            {teams?.map((s) => {
              return (
                <Grid.Dropdown.Item
                  key={s.value}
                  value={s.value}
                  title={s.title}
                />
              );
            })}
          </Grid.Dropdown>
        ),
      };

  if (teamId === "-1") {
    listProps.searchText = terms;
    listProps.onSearchTextChange = setTerms;
  }

  return (
    <Grid throttle isLoading={isLoading} pagination={pagination} {...listProps}>
      {props.club && (
        <Grid.EmptyView
          icon="empty.png"
          title="We don't have any data on this club."
        />
      )}
      {!props.club && terms.length < 3 && (
        <Grid.EmptyView
          icon="player-missing.png"
          title="Search terms length must be at least 3 characters long."
        />
      )}
      {(!terms || terms.length >= 3) &&
        data?.map((p) => {
          return (
            <Grid.Item
              key={p.id}
              title={p.name.display}
              subtitle={p.info.positionInfo}
              keywords={[p.info.positionInfo]}
              content={{
                source: `https://resources.premierleague.com/premierleague/photos/players/250x250/${p.altIds.opta}.png`,
                fallback: "player-missing.png",
              }}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="View Player"
                    icon={Icon.Sidebar}
                    target={<PlayerProfile {...p} />}
                  />
                </ActionPanel>
              }
            />
          );
        })}
    </Grid>
  );
}
